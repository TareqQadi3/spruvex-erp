import { withTransaction, type DbOrTx } from "../../../core/database/transaction";
import { AppError } from "../../../core/errors/AppError";
import { recordAuditEvent } from "../../../core/logging/auditLogger";
import type { TenantContext } from "../../../shared/types/tenantContext";
import { StockRepository } from "../repositories/stockRepository";
import { StockMovementRepository, type ListMovementsFilters } from "../repositories/stockMovementRepository";
import type {
  AdjustStockInput,
  AggregatedStock,
  CommitStockDeductionInput,
  ReserveStockInput,
  StockLevel,
  TransferStockInput,
} from "../types/inventory.types";

const stockRepo = new StockRepository();
const movementRepo = new StockMovementRepository();

async function resolveWarehouseId(companyId: string, explicitWarehouseId: string | undefined, client: DbOrTx): Promise<string> {
  if (explicitWarehouseId) return explicitWarehouseId;
  const defaultWarehouseId = await stockRepo.resolveDefaultWarehouseId(companyId, client);
  if (!defaultWarehouseId) throw AppError.validation("No default warehouse configured for this company");
  return defaultWarehouseId;
}

// A. getStock — per-warehouse breakdown, or a single warehouse's level when
// warehouseId is given.
export async function getStock(companyId: string, productId: string, warehouseId?: string): Promise<AggregatedStock> {
  let rows = await stockRepo.findAllForProduct(companyId, productId);

  // A product that predates any inventory-engine write has zero stock rows,
  // even though products.stock may be non-zero — lazily migrate it the same
  // way a mutating operation would, so reads stay consistent with writes.
  if (rows.length === 0) {
    const created = await withTransaction(async (tx) => {
      const targetWarehouseId = await resolveWarehouseId(companyId, warehouseId, tx);
      return stockRepo.ensureRow(companyId, productId, targetWarehouseId, tx);
    });
    if (!created) throw AppError.notFound("Product not found");
    rows = await stockRepo.findAllForProduct(companyId, productId);
  }

  const byWarehouse: StockLevel[] = rows.map((row) => ({
    productId,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouseName,
    quantity: row.quantity,
    reservedQuantity: row.reservedQuantity,
    available: row.quantity - row.reservedQuantity,
  }));

  const filtered = warehouseId ? byWarehouse.filter((level) => level.warehouseId === warehouseId) : byWarehouse;
  if (warehouseId && filtered.length === 0) {
    throw AppError.notFound("No stock record for this product at the given warehouse");
  }

  const totalQuantity = filtered.reduce((sum, level) => sum + level.quantity, 0);
  const totalReserved = filtered.reduce((sum, level) => sum + level.reservedQuantity, 0);

  return {
    productId,
    totalQuantity,
    totalReserved,
    totalAvailable: totalQuantity - totalReserved,
    byWarehouse: filtered,
  };
}

// A2. listStockMovements — paginated audit-trail read, joined to
// product/warehouse/user names for display. Read-only, no tenant mutation.
export async function listStockMovements(companyId: string, filters: ListMovementsFilters) {
  const { rows, total } = await movementRepo.listWithDetails(companyId, filters);
  return {
    data: rows,
    meta: { page: filters.page, pageSize: filters.pageSize, total },
  };
}

// B. adjustStock — manual correction (damage, shrinkage, recount).
export async function adjustStock(tenant: TenantContext, input: AdjustStockInput) {
  return withTransaction(async (tx) => {
    const existing = await stockRepo.ensureRow(tenant.companyId, input.productId, input.warehouseId, tx);
    if (!existing) throw AppError.notFound("Product not found");

    const updated = await stockRepo.applyQuantityDelta(
      tenant.companyId,
      input.productId,
      input.warehouseId,
      input.quantityDelta,
      tx,
    );
    if (!updated) {
      throw AppError.conflict(
        `Adjustment would result in negative stock (current: ${existing.quantity}, delta: ${input.quantityDelta})`,
      );
    }

    await movementRepo.record(
      tenant.companyId,
      {
        productId: input.productId,
        warehouseId: input.warehouseId,
        movementType: input.quantityDelta >= 0 ? "adjustment_in" : "adjustment_out",
        quantity: Math.abs(input.quantityDelta),
        referenceType: "manual_adjustment",
        createdBy: tenant.userId,
      },
      tx,
    );

    await stockRepo.syncProductStockColumn(tenant.companyId, input.productId, tx);

    recordAuditEvent(tenant, {
      action: "adjust_stock",
      entityType: "product",
      entityId: input.productId,
      details: { warehouseId: input.warehouseId, quantityDelta: input.quantityDelta, reason: input.reason },
    });

    return updated;
  });
}

// C. transferStock — warehouse A -> warehouse B, atomic, exactly 2 movement rows.
export async function transferStock(tenant: TenantContext, input: TransferStockInput) {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw AppError.validation("Source and destination warehouse must differ");
  }

  return withTransaction(async (tx) => {
    const source = await stockRepo.ensureRow(tenant.companyId, input.productId, input.fromWarehouseId, tx);
    if (!source) throw AppError.notFound("Product not found");
    await stockRepo.ensureRow(tenant.companyId, input.productId, input.toWarehouseId, tx);

    const debited = await stockRepo.applyQuantityDelta(
      tenant.companyId,
      input.productId,
      input.fromWarehouseId,
      -input.quantity,
      tx,
    );
    if (!debited) {
      throw AppError.conflict(`Insufficient stock at source warehouse (have ${source.quantity}, need ${input.quantity})`);
    }

    const credited = await stockRepo.applyQuantityDelta(
      tenant.companyId,
      input.productId,
      input.toWarehouseId,
      input.quantity,
      tx,
    );
    if (!credited) throw AppError.internal("Failed to credit destination warehouse");

    // Shared reference id correlates the two legs of the same transfer.
    const transferReferenceId = crypto.randomUUID();
    await movementRepo.record(
      tenant.companyId,
      {
        productId: input.productId,
        warehouseId: input.fromWarehouseId,
        movementType: "transfer_out",
        quantity: input.quantity,
        referenceType: "transfer",
        referenceId: transferReferenceId,
        createdBy: tenant.userId,
      },
      tx,
    );
    await movementRepo.record(
      tenant.companyId,
      {
        productId: input.productId,
        warehouseId: input.toWarehouseId,
        movementType: "transfer_in",
        quantity: input.quantity,
        referenceType: "transfer",
        referenceId: transferReferenceId,
        createdBy: tenant.userId,
      },
      tx,
    );

    recordAuditEvent(tenant, {
      action: "transfer_stock",
      entityType: "product",
      entityId: input.productId,
      details: { from: input.fromWarehouseId, to: input.toWarehouseId, quantity: input.quantity },
    });

    return { source: debited, destination: credited, transferReferenceId };
  });
}

// D. reserveStock — used by POS before confirming a sale. Only increments
// reservedQuantity (a hold); the physical quantity is untouched until
// commitStockDeduction finalizes it. Accepts an optional `client` so it can
// participate in a caller's already-open transaction (e.g. a sale in progress).
export async function reserveStock(tenant: TenantContext, input: ReserveStockInput, client?: DbOrTx) {
  const run = async (tx: DbOrTx) => {
    const warehouseId = await resolveWarehouseId(tenant.companyId, input.warehouseId, tx);
    const row = await stockRepo.ensureRow(tenant.companyId, input.productId, warehouseId, tx);
    if (!row) throw AppError.notFound("Product not found");

    const updated = await stockRepo.applyReservedDelta(tenant.companyId, input.productId, warehouseId, input.quantity, tx);
    if (!updated) {
      throw AppError.conflict(
        `Insufficient available stock to reserve (available: ${row.quantity - row.reservedQuantity}, requested: ${input.quantity})`,
      );
    }

    await movementRepo.record(
      tenant.companyId,
      {
        productId: input.productId,
        warehouseId,
        movementType: "reservation",
        quantity: input.quantity,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        createdBy: tenant.userId,
      },
      tx,
    );

    return updated;
  };
  return client ? run(client) : withTransaction(run);
}

// E. commitStockDeduction — final deduction once a sale is confirmed.
// releaseReservedQuantity=true finalizes a prior reserveStock call (consumes
// the hold, decrementing both reservedQuantity and quantity); false (the POS
// compatibility layer's case — no prior reserve in the current sale flow)
// only decrements the physical quantity. Also accepts an optional `client`
// for the same reason as reserveStock.
export async function commitStockDeduction(
  tenant: TenantContext,
  input: CommitStockDeductionInput & { releaseReservedQuantity?: boolean },
  client?: DbOrTx,
) {
  const run = async (tx: DbOrTx) => {
    const warehouseId = await resolveWarehouseId(tenant.companyId, input.warehouseId, tx);
    const row = await stockRepo.ensureRow(tenant.companyId, input.productId, warehouseId, tx);
    if (!row) throw AppError.notFound("Product not found");

    const updated = await stockRepo.applyQuantityDelta(tenant.companyId, input.productId, warehouseId, -input.quantity, tx);
    if (!updated) {
      throw AppError.conflict(`Insufficient stock (have ${row.quantity}, need ${input.quantity})`);
    }

    if (input.releaseReservedQuantity) {
      const released = await stockRepo.applyReservedDelta(tenant.companyId, input.productId, warehouseId, -input.quantity, tx);
      if (!released) throw AppError.internal("Failed to release the matching reservation");
    }

    await movementRepo.record(
      tenant.companyId,
      {
        productId: input.productId,
        warehouseId,
        movementType: "sale",
        quantity: input.quantity,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        createdBy: tenant.userId,
      },
      tx,
    );

    await stockRepo.syncProductStockColumn(tenant.companyId, input.productId, tx);

    return updated;
  };
  return client ? run(client) : withTransaction(run);
}

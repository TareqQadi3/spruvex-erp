import { eq, and } from "drizzle-orm";
import { warehousesTable, stockMovementsTable } from "@workspace/db";
import type { DbOrTx } from "../core/database/transaction";

// Every real stock change (sale, purchase, return, adjustment, transfer,
// opening balance) gets an append-only row here — the audit trail the
// warehouse-scoped inventory engine (modules/inventory) already relies on.
// products.stock stays the number the live POS/sales/purchases flows read
// and write directly (unchanged, zero regression risk); this is purely
// additive logging alongside those existing writes, not a replacement for
// them.
export type StockMovementType =
  | "purchase" | "sale" | "sale_return" | "adjustment_in" | "adjustment_out"
  | "transfer_in" | "transfer_out" | "opening_balance" | "reservation" | "reservation_release";

let cachedDefaultWarehouse = new Map<string, string>();

async function resolveWarehouseId(client: DbOrTx, companyId: string, explicit?: string | null): Promise<string | undefined> {
  if (explicit) return explicit;
  if (cachedDefaultWarehouse.has(companyId)) return cachedDefaultWarehouse.get(companyId);
  const [wh] = await client.select().from(warehousesTable)
    .where(and(eq(warehousesTable.companyId, companyId), eq(warehousesTable.isDefault, true))).limit(1);
  if (wh) cachedDefaultWarehouse.set(companyId, wh.id);
  return wh?.id;
}

export async function logStockMovement(
  client: DbOrTx,
  input: {
    companyId: string;
    productId: string;
    warehouseId?: string | null;
    movementType: StockMovementType;
    quantity: number; // signed: positive = stock in, negative = stock out
    referenceType?: string;
    referenceId?: string;
    createdBy?: string;
  },
): Promise<void> {
  const warehouseId = await resolveWarehouseId(client, input.companyId, input.warehouseId);
  if (!warehouseId) return; // no warehouse provisioned yet (shouldn't happen post-signup) — never block the caller's real write over this
  await client.insert(stockMovementsTable).values({
    companyId: input.companyId,
    productId: input.productId,
    warehouseId,
    movementType: input.movementType,
    quantity: input.quantity,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    createdBy: input.createdBy,
  });
}

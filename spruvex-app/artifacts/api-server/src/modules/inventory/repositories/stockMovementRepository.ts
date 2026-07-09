import { desc, eq, gte, lte, sql } from "drizzle-orm";
import { productsTable, stockMovementsTable, usersTable, warehousesTable, type StockMovementType } from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { withTenantScope } from "../../../core/database/compositeKey";

export interface RecordMovementInput {
  productId: string;
  warehouseId: string;
  movementType: StockMovementType;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  createdBy?: string;
}

export interface ListMovementsFilters {
  productId?: string;
  warehouseId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  pageSize: number;
}

// Append-only — no update/delete methods on purpose. This table is the
// audit trail; corrections happen by recording a new, opposite movement,
// never by editing history.
export class StockMovementRepository {
  async record(companyId: string, entry: RecordMovementInput, client: DbOrTx = db) {
    const [row] = await client
      .insert(stockMovementsTable)
      .values({ companyId, ...entry })
      .returning();
    return row;
  }

  async listForProduct(companyId: string, productId: string, client: DbOrTx = db) {
    return client
      .select()
      .from(stockMovementsTable)
      .where(withTenantScope(stockMovementsTable.companyId, companyId, eq(stockMovementsTable.productId, productId)))
      .orderBy(desc(stockMovementsTable.createdAt));
  }

  // Read side of the audit trail — joined to products/warehouses/users so the
  // UI can render names instead of raw ids, filterable and paginated for a
  // history view.
  async listWithDetails(companyId: string, filters: ListMovementsFilters, client: DbOrTx = db) {
    const conditions = withTenantScope(
      stockMovementsTable.companyId,
      companyId,
      filters.productId ? eq(stockMovementsTable.productId, filters.productId) : undefined,
      filters.warehouseId ? eq(stockMovementsTable.warehouseId, filters.warehouseId) : undefined,
      filters.dateFrom ? gte(stockMovementsTable.createdAt, filters.dateFrom) : undefined,
      filters.dateTo ? lte(stockMovementsTable.createdAt, filters.dateTo) : undefined,
    );

    const offset = (filters.page - 1) * filters.pageSize;

    const [rows, [{ count }]] = await Promise.all([
      client
        .select({
          id: stockMovementsTable.id,
          productId: stockMovementsTable.productId,
          productName: productsTable.name,
          productSku: productsTable.sku,
          warehouseId: stockMovementsTable.warehouseId,
          warehouseName: warehousesTable.name,
          movementType: stockMovementsTable.movementType,
          quantity: stockMovementsTable.quantity,
          referenceType: stockMovementsTable.referenceType,
          referenceId: stockMovementsTable.referenceId,
          createdBy: stockMovementsTable.createdBy,
          createdByUsername: usersTable.username,
          createdAt: stockMovementsTable.createdAt,
        })
        .from(stockMovementsTable)
        .innerJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
        .innerJoin(warehousesTable, eq(stockMovementsTable.warehouseId, warehousesTable.id))
        .leftJoin(usersTable, eq(stockMovementsTable.createdBy, usersTable.id))
        .where(conditions)
        .orderBy(desc(stockMovementsTable.createdAt))
        .limit(filters.pageSize)
        .offset(offset),
      client.select({ count: sql<number>`count(*)::int` }).from(stockMovementsTable).where(conditions),
    ]);

    return { rows, total: count };
  }
}

import { and, eq, sql } from "drizzle-orm";
import { productsTable, stockTable, warehousesTable } from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { withTenantScope } from "../../../core/database/compositeKey";

export class StockRepository {
  // Row-locked for the rest of the transaction — every mutating inventory
  // operation reads through here first so concurrent operations on the same
  // (product, warehouse) serialize instead of racing.
  async findForUpdate(companyId: string, productId: string, warehouseId: string, client: DbOrTx = db) {
    const [row] = await client
      .select()
      .from(stockTable)
      .where(
        withTenantScope(stockTable.companyId, companyId, eq(stockTable.productId, productId), eq(stockTable.warehouseId, warehouseId)),
      )
      .for("update");
    return row ?? null;
  }

  async findAllForProduct(companyId: string, productId: string, client: DbOrTx = db) {
    return client
      .select({
        warehouseId: stockTable.warehouseId,
        warehouseName: warehousesTable.name,
        quantity: stockTable.quantity,
        reservedQuantity: stockTable.reservedQuantity,
      })
      .from(stockTable)
      .innerJoin(warehousesTable, eq(stockTable.warehouseId, warehousesTable.id))
      .where(withTenantScope(stockTable.companyId, companyId, eq(stockTable.productId, productId)));
  }

  // Lazily creates a stock row for a (product, warehouse) combo the initial
  // migration backfill didn't cover — e.g. a product created afterwards, or
  // a warehouse a product has never held stock in before. Only seeded from
  // the legacy products.stock column if this is the product's very first
  // stock row anywhere: a second (or later) warehouse being touched for a
  // product that already has stock elsewhere must start at 0 — the legacy
  // total was already claimed by that first row, and re-seeding it here
  // would double-count it.
  async ensureRow(companyId: string, productId: string, warehouseId: string, client: DbOrTx = db) {
    const existing = await this.findForUpdate(companyId, productId, warehouseId, client);
    if (existing) return existing;

    const [product] = await client
      .select({ stock: productsTable.stock })
      .from(productsTable)
      .where(and(eq(productsTable.companyId, companyId), eq(productsTable.id, productId)))
      .limit(1);
    if (!product) return null;

    const [anyExistingRow] = await client
      .select({ id: stockTable.id })
      .from(stockTable)
      .where(and(eq(stockTable.companyId, companyId), eq(stockTable.productId, productId)))
      .limit(1);
    const seedQuantity = anyExistingRow ? 0 : product.stock;

    await client
      .insert(stockTable)
      .values({ companyId, productId, warehouseId, quantity: seedQuantity, reservedQuantity: 0 })
      .onConflictDoNothing();

    return this.findForUpdate(companyId, productId, warehouseId, client);
  }

  async resolveDefaultWarehouseId(companyId: string, client: DbOrTx = db): Promise<string | null> {
    const [warehouse] = await client
      .select({ id: warehousesTable.id })
      .from(warehousesTable)
      .where(and(eq(warehousesTable.companyId, companyId), eq(warehousesTable.isDefault, true)))
      .limit(1);
    return warehouse?.id ?? null;
  }

  // Guarded: quantity can never go negative. Returns null if the guard fails
  // (insufficient stock) or the row doesn't exist — the caller must treat
  // null as "reject the whole operation."
  async applyQuantityDelta(companyId: string, productId: string, warehouseId: string, delta: number, client: DbOrTx = db) {
    const [updated] = await client
      .update(stockTable)
      .set({ quantity: sql`${stockTable.quantity} + ${delta}` })
      .where(
        and(
          eq(stockTable.companyId, companyId),
          eq(stockTable.productId, productId),
          eq(stockTable.warehouseId, warehouseId),
          sql`${stockTable.quantity} + ${delta} >= 0`,
        ),
      )
      .returning();
    return updated ?? null;
  }

  // Guarded: reservedQuantity can never go negative, and can never exceed the
  // physical quantity (you cannot reserve more than is on hand).
  async applyReservedDelta(companyId: string, productId: string, warehouseId: string, delta: number, client: DbOrTx = db) {
    const [updated] = await client
      .update(stockTable)
      .set({ reservedQuantity: sql`${stockTable.reservedQuantity} + ${delta}` })
      .where(
        and(
          eq(stockTable.companyId, companyId),
          eq(stockTable.productId, productId),
          eq(stockTable.warehouseId, warehouseId),
          sql`${stockTable.reservedQuantity} + ${delta} >= 0`,
          sql`${stockTable.reservedQuantity} + ${delta} <= ${stockTable.quantity}`,
        ),
      )
      .returning();
    return updated ?? null;
  }

  // Keeps the legacy products.stock column in sync as a backward-compatible
  // mirror (sum across all warehouses) — anything still reading it directly
  // keeps seeing a correct number even though stock/stock_movements are now
  // the real source of truth.
  async syncProductStockColumn(companyId: string, productId: string, client: DbOrTx = db): Promise<void> {
    const rows = await this.findAllForProduct(companyId, productId, client);
    const total = rows.reduce((sum, row) => sum + row.quantity, 0);
    await client
      .update(productsTable)
      .set({ stock: total })
      .where(and(eq(productsTable.companyId, companyId), eq(productsTable.id, productId)));
  }
}

import { and, eq, sql } from "drizzle-orm";
import { productsTable, stockTable, warehousesTable } from "@workspace/db";
import type { DbOrTx } from "../core/database/transaction";
import { logStockMovement, type StockMovementType } from "./stockMovementLogger";

// The inventory engine (modules/inventory) is the real source of truth for
// stock: it writes the per-warehouse `stock` table and keeps `products.stock`
// as a backward-compatible mirror via syncProductStockColumn. But the two
// live legacy flows — POS sales and purchases — historically wrote only
// `products.stock` (plus a movement row), never the per-warehouse table, so
// the two diverged after every sale: the inventory pages showed stale stock
// and a later stock adjustment would "restore" already-sold units.
//
// applyStockDelta is the single write path both flows now use. It keeps the
// three representations coherent in one call:
//   1. stock (per-warehouse snapshot, guarded against going negative)
//   2. products.stock (global legacy mirror)
//   3. stock_movements (append-only audit trail)
//
// Returns the warehouse the movement was booked against, or null when the
// per-warehouse guard rejected the change (insufficient stock) — callers must
// treat null as "reject the whole operation".
export async function applyStockDelta(
  client: DbOrTx,
  input: {
    companyId: string;
    productId: string;
    delta: number; // signed: positive = stock in, negative = stock out
    warehouseId?: string | null;
    movementType: StockMovementType;
    referenceType?: string;
    referenceId?: string;
  },
): Promise<string | null> {
  const { companyId, productId, delta } = input;

  const [product] = await client
    .select({ stock: productsTable.stock })
    .from(productsTable)
    .where(and(eq(productsTable.companyId, companyId), eq(productsTable.id, productId)))
    .limit(1);
  if (!product) return null;

  let warehouseId = input.warehouseId ?? null;
  if (!warehouseId) {
    const [wh] = await client
      .select({ id: warehousesTable.id })
      .from(warehousesTable)
      .where(and(eq(warehousesTable.companyId, companyId), eq(warehousesTable.isDefault, true)))
      .limit(1);
    warehouseId = wh?.id ?? null;
  }

  if (warehouseId) {
    // Lazily create the stock row, seeding it from the legacy column only when
    // this is the product's first stock row anywhere — the legacy total is
    // claimed exactly once, and any later warehouse starts at 0. Mirrors
    // StockRepository.ensureRow's logic.
    const [existing] = await client
      .select({ id: stockTable.id })
      .from(stockTable)
      .where(
        and(
          eq(stockTable.companyId, companyId),
          eq(stockTable.productId, productId),
          eq(stockTable.warehouseId, warehouseId),
        ),
      )
      .limit(1);
    if (!existing) {
      const [anyRow] = await client
        .select({ id: stockTable.id })
        .from(stockTable)
        .where(and(eq(stockTable.companyId, companyId), eq(stockTable.productId, productId)))
        .limit(1);
      const seedQuantity = anyRow ? 0 : product.stock;
      await client
        .insert(stockTable)
        .values({ companyId, productId, warehouseId, quantity: seedQuantity, reservedQuantity: 0 })
        .onConflictDoNothing();
    }

    // Guarded: quantity can never go negative. A failed guard means the
    // per-warehouse truth disagrees with products.stock (pre-existing
    // divergence from before this helper existed) — reject the change so the
    // ledger, stock tables and future syncs don't diverge further.
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
    if (!updated) return null;
  }

  await client
    .update(productsTable)
    .set({ stock: sql`${productsTable.stock} + ${delta}` })
    .where(and(eq(productsTable.companyId, companyId), eq(productsTable.id, productId)));

  await logStockMovement(client, {
    companyId,
    productId,
    warehouseId,
    movementType: input.movementType,
    quantity: delta,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
  });

  return warehouseId;
}

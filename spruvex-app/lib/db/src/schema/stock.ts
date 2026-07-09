import { pgTable, uuid, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// The cached snapshot — quantity per (product, warehouse). Never the source
// of truth on its own; every mutation here must be paired with a
// stock_movements row (see stockMovements.ts) that explains why it changed.
// reservedQuantity is stock held for an in-progress sale (see
// InventoryService.reserveStock) — available-to-sell is quantity - reservedQuantity.
export const stockTable = pgTable("stock", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  productId: uuid("product_id").notNull(),
  warehouseId: uuid("warehouse_id").notNull(),
  quantity: integer("quantity").notNull().default(0),
  reservedQuantity: integer("reserved_quantity").notNull().default(0),
}, (table) => [
  uniqueIndex("stock_product_warehouse_idx").on(table.productId, table.warehouseId),
]);

export const insertStockSchema = createInsertSchema(stockTable).omit({ id: true });
export type InsertStock = z.infer<typeof insertStockSchema>;
export type Stock = typeof stockTable.$inferSelect;

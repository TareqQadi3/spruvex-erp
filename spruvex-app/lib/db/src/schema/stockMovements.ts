import { pgTable, uuid, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Append-only ledger — the source of truth for every stock change. The
// `stock` table is only ever a derived cache of these rows summed up.
export const STOCK_MOVEMENT_TYPES = [
  "adjustment_in",
  "adjustment_out",
  "transfer_in",
  "transfer_out",
  "sale",
  "sale_return",
  "reservation",
  "reservation_release",
] as const;
export type StockMovementType = typeof STOCK_MOVEMENT_TYPES[number];

export const stockMovementsTable = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  productId: uuid("product_id").notNull(),
  warehouseId: uuid("warehouse_id").notNull(),
  movementType: text("movement_type").notNull(),
  quantity: integer("quantity").notNull(),
  // Polymorphic pointer at whatever caused the movement (a sale, a transfer
  // group, a manual adjustment note) without a separate FK per source table.
  referenceType: text("reference_type"),
  referenceId: uuid("reference_id"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStockMovementSchema = createInsertSchema(stockMovementsTable).omit({ id: true, createdAt: true });
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type StockMovement = typeof stockMovementsTable.$inferSelect;

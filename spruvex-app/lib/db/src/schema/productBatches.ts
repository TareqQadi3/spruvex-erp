import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Lot/batch tracking for perishables received in separate shipments with
// different expiry dates (e.g. two cartons of the same milk SKU, one expiring
// this week, one next month). Foundation table for this phase — FIFO
// consumption during a sale (deducting from the earliest-expiring batch
// first) is not wired yet; today `products.stock` remains the single number
// the POS/inventory engine reads, and this table is purely informational
// (receiving date, batch number, expiry) until that consumption logic lands.
export const productBatchesTable = pgTable("product_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  productId: uuid("product_id").notNull(),
  batchNumber: text("batch_number").notNull(),
  quantity: integer("quantity").notNull().default(0),
  expiryDate: timestamp("expiry_date"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});

export const insertProductBatchSchema = createInsertSchema(productBatchesTable).omit({ id: true, receivedAt: true });
export type InsertProductBatch = z.infer<typeof insertProductBatchSchema>;
export type ProductBatch = typeof productBatchesTable.$inferSelect;

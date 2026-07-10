import { pgTable, uuid, text, timestamp, numeric, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Staging area for orders arriving from an external sales channel (webhook or
// manual pull). An external order is never written straight into `sales` —
// it lands here first so a failed/unmappable order can be inspected and
// retried instead of silently dropped, and so the same order arriving twice
// (webhook + pull) dedupes on (connectionId, externalOrderId). Conversion to
// a real sale is an explicit step that sets saleId + status "imported".
export const ecommerceOrdersTable = pgTable("ecommerce_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  connectionId: uuid("connection_id").notNull(),
  externalOrderId: text("external_order_id").notNull(),
  externalOrderNumber: text("external_order_number"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("SAR"),
  status: text("status").notNull().default("received"), // received | importing (transient claim) | imported | failed | ignored
  // Raw provider payload as received — the import step re-reads items from
  // here, so nothing is lost between staging and conversion.
  payload: jsonb("payload"),
  errorMessage: text("error_message"),
  saleId: uuid("sale_id"),
  importedAt: timestamp("imported_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ecommerce_orders_connection_external_idx").on(table.connectionId, table.externalOrderId),
  index("ecommerce_orders_company_created_idx").on(table.companyId, table.createdAt),
]);

export const insertEcommerceOrderSchema = createInsertSchema(ecommerceOrdersTable).omit({ id: true, createdAt: true });
export type InsertEcommerceOrder = z.infer<typeof insertEcommerceOrderSchema>;
export type EcommerceOrder = typeof ecommerceOrdersTable.$inferSelect;

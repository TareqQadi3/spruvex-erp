import { pgTable, uuid, text, timestamp, integer, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One stock-in event from a supplier. returnedQuantity tracks partial returns
// against this purchase without needing a separate "remaining" column.
export const purchasesTable = pgTable("purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  productId: uuid("product_id").notNull(),
  supplierId: uuid("supplier_id").notNull(),
  quantity: integer("quantity").notNull(),
  returnedQuantity: integer("returned_quantity").notNull().default(0),
  totalCost: numeric("total_cost", { precision: 10, scale: 2 }).notNull(),
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("purchases_company_created_idx").on(table.companyId, table.createdAt),
  index("purchases_company_supplier_idx").on(table.companyId, table.supplierId),
]);

export const insertPurchaseSchema = createInsertSchema(purchasesTable).omit({ id: true, createdAt: true });
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchasesTable.$inferSelect;

export const purchaseReturnsTable = pgTable("purchase_returns", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  purchaseId: uuid("purchase_id").notNull(),
  returnNumber: text("return_number").notNull(),
  reason: text("reason"),
  quantity: integer("quantity").notNull(),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("purchase_returns_company_purchase_idx").on(table.companyId, table.purchaseId),
]);

export const insertPurchaseReturnSchema = createInsertSchema(purchaseReturnsTable).omit({ id: true, createdAt: true });
export type InsertPurchaseReturn = z.infer<typeof insertPurchaseReturnSchema>;
export type PurchaseReturn = typeof purchaseReturnsTable.$inferSelect;

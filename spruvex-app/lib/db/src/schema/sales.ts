import { pgTable, uuid, text, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salesTable = pgTable("sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  customerId: uuid("customer_id"),
  cashSessionId: uuid("cash_session_id"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).notNull().default("0"),
  change: numeric("change", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method").notNull().default("cash"),
  paymentMethodId: uuid("payment_method_id"),
  paymentFee: numeric("payment_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("completed"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const saleItemsTable = pgTable("sale_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Denormalized alongside saleId on purpose: any direct query against sale_items
  // (reports, AI features, future admin tooling) must be tenant-scoped without
  // requiring a join through sales first — see the multi-tenancy audit.
  companyId: uuid("company_id").notNull(),
  saleId: uuid("sale_id").notNull(),
  productId: uuid("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  returnedQuantity: integer("returned_quantity").notNull().default(0),
});

// One row per payment method used on a sale — a single-method sale can still get
// a row (for uniformity) or rely on salesTable.paymentMethod alone; a split sale
// (100 cash + 200 card) gets one row per method, each carrying its own fee basis.
export const salePaymentsTable = pgTable("sale_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  saleId: uuid("sale_id").notNull(),
  paymentMethodId: uuid("payment_method_id"),
  methodName: text("method_name").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A return/exchange event against a sale. refundAmount/exchangeAmount/netAmount
// are running totals updated as return items are recorded (see updateReturnTotals).
export const saleReturnsTable = pgTable("sale_returns", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  saleId: uuid("sale_id").notNull(),
  returnNumber: text("return_number").notNull(),
  reason: text("reason"),
  refundMethod: text("refund_method").notNull().default("cash"), // cash | store_credit
  refundAmount: numeric("refund_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  exchangeAmount: numeric("exchange_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  netAmount: numeric("net_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Line items of a return: returned units (saleItemId set, isExchange false) and/or
// exchanged-in units (saleItemId null, productId + isExchange true) in the same event.
export const saleReturnItemsTable = pgTable("sale_return_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  saleReturnId: uuid("sale_return_id").notNull(),
  saleItemId: uuid("sale_item_id"),
  productId: uuid("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  isExchange: boolean("is_exchange").notNull().default(false),
});

export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, createdAt: true });
export const insertSaleItemSchema = createInsertSchema(saleItemsTable).omit({ id: true });
export const insertSalePaymentSchema = createInsertSchema(salePaymentsTable).omit({ id: true, createdAt: true });
export const insertSaleReturnSchema = createInsertSchema(saleReturnsTable).omit({ id: true, createdAt: true });
export const insertSaleReturnItemSchema = createInsertSchema(saleReturnItemsTable).omit({ id: true });
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof salesTable.$inferSelect;
export type SaleItem = typeof saleItemsTable.$inferSelect;
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type InsertSalePayment = z.infer<typeof insertSalePaymentSchema>;
export type SalePayment = typeof salePaymentsTable.$inferSelect;
export type InsertSaleReturn = z.infer<typeof insertSaleReturnSchema>;
export type SaleReturn = typeof saleReturnsTable.$inferSelect;
export type InsertSaleReturnItem = z.infer<typeof insertSaleReturnItemSchema>;
export type SaleReturnItem = typeof saleReturnItemsTable.$inferSelect;

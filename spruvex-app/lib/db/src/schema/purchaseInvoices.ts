import { pgTable, uuid, text, timestamp, numeric, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Printable purchase-side documents (invoice from a supplier delivery, debit
// note from a purchase return). Deliberately NOT part of the ZATCA pipeline —
// ZATCA e-invoicing obligations apply to invoices this company ISSUES to its
// customers, not ones it receives from suppliers, so there is no XML/signing/
// QR/submission state machine here, just a numbered, printable record derived
// from an existing purchases/purchase_returns row.
export const PURCHASE_DOCUMENT_SOURCES = ["purchase", "purchase_return"] as const;
export type PurchaseDocumentSource = typeof PURCHASE_DOCUMENT_SOURCES[number];

export const purchaseInvoicesTable = pgTable("purchase_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  sourceType: text("source_type").notNull(), // purchase | purchase_return
  sourceId: uuid("source_id").notNull(), // purchases.id | purchase_returns.id
  documentNumber: text("document_number").notNull(),
  supplierId: uuid("supplier_id").notNull(),
  supplierName: text("supplier_name").notNull(),
  issueDate: timestamp("issue_date").defaultNow().notNull(),
  currency: text("currency").notNull().default("SAR"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  // One printable document per source record — re-requesting a document for
  // the same purchase/return returns the existing row instead of duplicating.
  uniqueIndex("purchase_invoices_source_idx").on(table.sourceType, table.sourceId),
]);

export const insertPurchaseInvoiceSchema = createInsertSchema(purchaseInvoicesTable).omit({ id: true, createdAt: true });
export type InsertPurchaseInvoice = z.infer<typeof insertPurchaseInvoiceSchema>;
export type PurchaseInvoice = typeof purchaseInvoicesTable.$inferSelect;

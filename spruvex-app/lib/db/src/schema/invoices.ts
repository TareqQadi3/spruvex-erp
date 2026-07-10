import { pgTable, uuid, text, timestamp, numeric, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const INVOICE_STATUSES = ["draft", "xml_generated", "signed", "submitted", "accepted", "rejected"] as const;
export type InvoiceStatus = typeof INVOICE_STATUSES[number];

export const INVOICE_TYPES = ["simplified", "standard", "credit_note", "debit_note"] as const;
export type InvoiceType = typeof INVOICE_TYPES[number];

// One invoice per sale (createInvoiceFromSale), or a credit/debit note linked
// back to the original via relatedInvoiceId. Immutable in content once
// status leaves "draft"/"xml_generated" — see modules/zatca/services/invoiceStateMachine.ts.
export const invoicesTable = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  saleId: uuid("sale_id"),
  // Set only for invoiceType "credit_note" issued against a sale_returns row
  // (see modules/zatca's createCreditNoteFromReturn) — line items for such an
  // invoice come from sale_return_items, not sale_items.
  saleReturnId: uuid("sale_return_id"),
  relatedInvoiceId: uuid("related_invoice_id"),
  invoiceNumber: text("invoice_number").notNull(),
  invoiceType: text("invoice_type").notNull().default("simplified"),
  status: text("status").notNull().default("draft"),
  zatcaUuid: uuid("zatca_uuid").defaultRandom().notNull(),
  issueDate: timestamp("issue_date").defaultNow().notNull(),
  currency: text("currency").notNull().default("SAR"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  sellerName: text("seller_name").notNull(),
  sellerVatNumber: text("seller_vat_number"),
  buyerName: text("buyer_name"),
  buyerVatNumber: text("buyer_vat_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // A sale_return can be credit-noted at most once.
  uniqueIndex("invoices_sale_return_idx").on(table.saleReturnId),
  index("invoices_company_status_idx").on(table.companyId, table.status),
  index("invoices_company_sale_idx").on(table.companyId, table.saleId),
]);

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;

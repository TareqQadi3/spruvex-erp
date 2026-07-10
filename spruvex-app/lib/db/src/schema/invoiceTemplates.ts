import { pgTable, uuid, text, timestamp, boolean, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// documentKind selects which template pool a document draws from: "sales"
// covers ZATCA sales invoices and credit/debit notes (QR-capable); "purchase"
// covers purchase invoices/debit notes (never QR-capable — see
// purchaseInvoices.ts). printType selects the physical layout. Designed to be
// reused by future SpruVex products (see modules/invoicing) — the config
// shape is generic layout knobs, not anything sales/purchase-specific.
export const INVOICE_TEMPLATE_KINDS = ["sales", "purchase"] as const;
export type InvoiceTemplateKind = typeof INVOICE_TEMPLATE_KINDS[number];

export const INVOICE_TEMPLATE_PRINT_TYPES = ["thermal_58", "thermal_80", "a4"] as const;
export type InvoiceTemplatePrintType = typeof INVOICE_TEMPLATE_PRINT_TYPES[number];

export const invoiceTemplatesTable = pgTable("invoice_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  documentKind: text("document_kind").notNull(), // sales | purchase
  printType: text("print_type").notNull(), // thermal_58 | thermal_80 | a4
  // Only one default per (companyId, documentKind, printType) — enforced in
  // the service layer (clear-then-set inside one transaction), not the DB,
  // since a partial unique index keyed on a boolean is more schema ceremony
  // than this needs.
  isDefault: boolean("is_default").notNull().default(false),
  // TemplateConfig shape (modules/invoicing/types/print.types.ts): layout
  // knobs only (show/hide logo, header/footer free text, language, accent
  // color, show buyer info) — never arbitrary HTML/user templates, to keep
  // the renderer injection-safe.
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("invoice_templates_company_name_idx").on(table.companyId, table.name),
]);

export const insertInvoiceTemplateSchema = createInsertSchema(invoiceTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoiceTemplate = z.infer<typeof insertInvoiceTemplateSchema>;
export type InvoiceTemplate = typeof invoiceTemplatesTable.$inferSelect;

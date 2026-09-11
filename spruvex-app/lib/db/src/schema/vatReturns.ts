import { pgTable, uuid, text, date, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// T-12: an internal aggregated VAT return report, generated from this
// company's own already-issued ZATCA invoices (output VAT) and recorded
// purchase invoices (input VAT). This is NOT a live integration with
// ZATCA's filing portal — no such public API exists; the actual monthly/
// quarterly filing remains a manual step through ZATCA's own portal. This
// table exists purely to compute and preserve the supporting figures for
// that manual filing, and to lock them once a period is finalized so the
// numbers can't silently drift if invoices are edited afterward.
export const VAT_RETURN_STATUSES = ["draft", "finalized"] as const;
export type VatReturnStatus = typeof VAT_RETURN_STATUSES[number];

export const vatReturnsTable = pgTable("vat_returns", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  totalSalesExVat: numeric("total_sales_ex_vat", { precision: 14, scale: 2 }).notNull().default("0"),
  totalOutputVat: numeric("total_output_vat", { precision: 14, scale: 2 }).notNull().default("0"),
  totalPurchasesExVat: numeric("total_purchases_ex_vat", { precision: 14, scale: 2 }).notNull().default("0"),
  totalInputVat: numeric("total_input_vat", { precision: 14, scale: 2 }).notNull().default("0"),
  netVatDue: numeric("net_vat_due", { precision: 14, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("draft"),
  finalizedAt: timestamp("finalized_at"),
  finalizedBy: uuid("finalized_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("vat_returns_company_period_idx").on(table.companyId, table.periodStart, table.periodEnd),
]);

export const insertVatReturnSchema = createInsertSchema(vatReturnsTable).omit({ id: true, createdAt: true });
export type InsertVatReturn = z.infer<typeof insertVatReturnSchema>;
export type VatReturn = typeof vatReturnsTable.$inferSelect;

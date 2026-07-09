import { pgTable, uuid, text, numeric, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  shopName: text("shop_name").notNull().default("My Shop"),
  shopAddress: text("shop_address"),
  shopPhone: text("shop_phone"),
  currency: text("currency").notNull().default("USD"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  receiptFooter: text("receipt_footer"),
  language: text("language").notNull().default("en"),
  logoUrl: text("logo_url"),
  invoiceHeaderText: text("invoice_header_text"),
  invoiceFooterText: text("invoice_footer_text"),
  showBarcode: boolean("show_barcode").notNull().default(false),
  invoiceType: text("invoice_type").notNull().default("a4"),
  repairsModuleEnabled: boolean("repairs_module_enabled").notNull().default(true),
  // Accounting / fiscal year (note #12)
  openingBalance: numeric("opening_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  fiscalYearStart: text("fiscal_year_start"),
  fiscalYearEnd: text("fiscal_year_end"),
  setupCompleted: boolean("setup_completed").notNull().default(false),
  // ZATCA e-invoicing (Saudi) — seller VAT registration for QR codes
  vatNumber: text("vat_number"),
  themeColor: text("theme_color").notNull().default("blue"),
  // Repair invoice printer profile (note #6); when mirrorSales true reuse the sales profile
  repairInvoiceType: text("repair_invoice_type").notNull().default("a4"),
  repairInvoiceSameAsSales: boolean("repair_invoice_same_as_sales").notNull().default(true),
}, (table) => [
  uniqueIndex("settings_company_idx").on(table.companyId),
]);

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;

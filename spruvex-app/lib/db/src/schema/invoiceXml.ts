import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Generated UBL 2.1 XML per invoice, 1:1 — kept immutable once written so the
// xml_hash used in signInvoice always matches exactly what was generated.
export const invoiceXmlTable = pgTable("invoice_xml", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  invoiceId: uuid("invoice_id").notNull().unique(),
  ublVersion: text("ubl_version").notNull().default("2.1"),
  xmlContent: text("xml_content").notNull(),
  xmlHash: text("xml_hash").notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export const insertInvoiceXmlSchema = createInsertSchema(invoiceXmlTable).omit({ id: true, generatedAt: true });
export type InsertInvoiceXml = z.infer<typeof insertInvoiceXmlSchema>;
export type InvoiceXml = typeof invoiceXmlTable.$inferSelect;

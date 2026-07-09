import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const qrCodesTable = pgTable("qr_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  invoiceId: uuid("invoice_id").notNull().unique(),
  qrContent: text("qr_content").notNull(), // base64-encoded ZATCA TLV payload
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export const insertQrCodeSchema = createInsertSchema(qrCodesTable).omit({ id: true, generatedAt: true });
export type InsertQrCode = z.infer<typeof insertQrCodeSchema>;
export type QrCode = typeof qrCodesTable.$inferSelect;

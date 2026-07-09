import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Cryptographic stamp chain: previousInvoiceHash links each invoice to the
// prior one signed for the same company, so tampering with any past invoice
// breaks the hash chain for every invoice after it. algorithm documents
// exactly what produced signatureValue — see signingService.ts for why this
// is a stub, not a real ZATCA-certificate ECDSA signature.
export const signaturesTable = pgTable("signatures", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  invoiceId: uuid("invoice_id").notNull().unique(),
  previousInvoiceHash: text("previous_invoice_hash"),
  invoiceHash: text("invoice_hash").notNull(),
  signatureValue: text("signature_value").notNull(),
  signingCertificate: text("signing_certificate"),
  algorithm: text("algorithm").notNull().default("HMAC-SHA256-STUB"),
  signedAt: timestamp("signed_at").defaultNow().notNull(),
});

export const insertSignatureSchema = createInsertSchema(signaturesTable).omit({ id: true, signedAt: true });
export type InsertSignature = z.infer<typeof insertSignatureSchema>;
export type Signature = typeof signaturesTable.$inferSelect;

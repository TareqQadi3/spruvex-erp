import { pgTable, uuid, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ZATCA_REQUEST_TYPES = ["compliance_check", "clearance", "reporting"] as const;
export type ZatcaRequestType = typeof ZATCA_REQUEST_TYPES[number];

// One row per ZATCA API call — a retried/rejected submission never overwrites
// a previous attempt's record, so the full submission history is auditable.
export const zatcaLogsTable = pgTable("zatca_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  invoiceId: uuid("invoice_id").notNull(),
  requestType: text("request_type").notNull(),
  status: text("status").notNull().default("pending"), // pending | success | failed
  httpStatusCode: integer("http_status_code"),
  requestPayload: jsonb("request_payload"),
  responsePayload: jsonb("response_payload"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
});

export const insertZatcaLogSchema = createInsertSchema(zatcaLogsTable).omit({ id: true, submittedAt: true });
export type InsertZatcaLog = z.infer<typeof insertZatcaLogSchema>;
export type ZatcaLog = typeof zatcaLogsTable.$inferSelect;

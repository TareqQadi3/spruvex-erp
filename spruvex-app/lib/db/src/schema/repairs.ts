import { pgTable, uuid, text, timestamp, numeric, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const repairsTable = pgTable("repairs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  ticketNumber: text("ticket_number").notNull(),
  customerId: uuid("customer_id"),
  deviceType: text("device_type").notNull(),
  deviceBrand: text("device_brand"),
  deviceModel: text("device_model"),
  imei: text("imei"),
  problemDescription: text("problem_description").notNull(),
  technicianNotes: text("technician_notes"),
  status: text("status").notNull().default("received"),
  repairCost: numeric("repair_cost", { precision: 10, scale: 2 }),
  estimatedCost: numeric("estimated_cost", { precision: 10, scale: 2 }),
  isPaid: boolean("is_paid").notNull().default(false),
  warrantyExpiresAt: timestamp("warranty_expires_at"),
  technicianId: uuid("technician_id"), // optional link to the assigned technician (users.id)
  approvedAt: timestamp("approved_at"), // set when the customer has explicitly approved the repair estimate
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("repairs_company_ticket_idx").on(table.companyId, table.ticketNumber),
]);

export const insertRepairSchema = createInsertSchema(repairsTable).omit({ id: true, ticketNumber: true, createdAt: true, updatedAt: true });
export type InsertRepair = z.infer<typeof insertRepairSchema>;
export type Repair = typeof repairsTable.$inferSelect;

// NOTE: pending decision — PROJECT_VISION.md specifies a different status set
// (received, diagnosed, waiting_approval, repairing, completed, delivered).
// Left as-is until that's explicitly resolved; see architecture conflict list.
export const REPAIR_STATUSES = [
  "received",
  "diagnosing",
  "waiting_for_parts",
  "in_repair",
  "ready_for_pickup",
  "delivered",
  "cancelled",
] as const;

// Audit trail of every status transition a repair ticket goes through —
// who changed it, when, and any note attached at that step.
export const repairStatusHistoryTable = pgTable("repair_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  repairId: uuid("repair_id").notNull(),
  status: text("status").notNull(),
  notes: text("notes"),
  changedBy: uuid("changed_by"),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
});

export const insertRepairStatusHistorySchema = createInsertSchema(repairStatusHistoryTable).omit({ id: true, changedAt: true });
export type InsertRepairStatusHistory = z.infer<typeof insertRepairStatusHistorySchema>;
export type RepairStatusHistory = typeof repairStatusHistoryTable.$inferSelect;

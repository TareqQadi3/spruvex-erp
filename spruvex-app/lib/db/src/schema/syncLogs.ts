import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per sync batch (push) attempt from a device — independent of
// individual offline_queue rows, so sync health (success/fail counts,
// latency) can be monitored per device over time. lastSyncAt for a device is
// derived as MAX(syncedAt) rather than tracked in a separate table.
export const syncLogsTable = pgTable("sync_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  deviceId: text("device_id").notNull(),
  successCount: integer("success_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  latencyMs: integer("latency_ms"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});

export const insertSyncLogSchema = createInsertSchema(syncLogsTable).omit({ id: true, syncedAt: true });
export type InsertSyncLog = z.infer<typeof insertSyncLogSchema>;
export type SyncLog = typeof syncLogsTable.$inferSelect;

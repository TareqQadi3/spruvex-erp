import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

// Generic who-did-what trail (Phase 6) — separate from the narrow per-entity
// history tables (repair_status_history, support_ticket_status_history)
// which stay as-is. userId nullable to allow future system-initiated events
// (cron jobs, webhooks) that have no acting user.
export const auditLogsTable = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  userId: uuid("user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("audit_logs_company_created_idx").on(table.companyId, table.createdAt),
  index("audit_logs_company_user_idx").on(table.companyId, table.userId),
  index("audit_logs_company_action_idx").on(table.companyId, table.action),
]);

export type AuditLog = typeof auditLogsTable.$inferSelect;
export type InsertAuditLog = typeof auditLogsTable.$inferInsert;

import { pgTable, uuid, text, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const OFFLINE_OPERATION_TYPES = [
  "create",
  "update",
  "delete",
  "adjust_stock",
  "create_sale",
  "create_payment",
] as const;
export type OfflineOperationType = typeof OFFLINE_OPERATION_TYPES[number];

export const OFFLINE_SYNC_STATUSES = ["pending", "synced", "failed"] as const;
export type OfflineSyncStatus = typeof OFFLINE_SYNC_STATUSES[number];

// One row per offline-queued action a device pushes. clientGeneratedId is
// produced on the device so a retried push is idempotent — enforced by the
// UNIQUE(company_id, client_generated_id) index, not just app-level checks.
export const offlineQueueTable = pgTable("offline_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  deviceId: text("device_id").notNull(),
  userId: uuid("user_id"),
  clientGeneratedId: uuid("client_generated_id").notNull(),
  entityType: text("entity_type").notNull(),
  operationType: text("operation_type").$type<OfflineOperationType>().notNull(),
  payload: jsonb("payload").notNull(),
  syncStatus: text("sync_status").$type<OfflineSyncStatus>().notNull().default("pending"),
  errorMessage: text("error_message"),
  syncedAt: timestamp("synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("offline_queue_company_client_id_idx").on(table.companyId, table.clientGeneratedId),
]);

export const insertOfflineQueueSchema = createInsertSchema(offlineQueueTable).omit({ id: true, createdAt: true });
export type InsertOfflineQueue = z.infer<typeof insertOfflineQueueSchema>;
export type OfflineQueueEntry = typeof offlineQueueTable.$inferSelect;

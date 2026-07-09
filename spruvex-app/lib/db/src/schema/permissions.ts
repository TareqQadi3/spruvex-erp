import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// companyId NULL = global permission code, available to every tenant (seeded
// from PERMISSIONS in roles.ts); non-null = a tenant's own custom permission.
export const permissionsTable = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id"),
  code: text("code").notNull(),
  module: text("module").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("permissions_global_code_idx").on(table.code).where(sql`${table.companyId} is null`),
  uniqueIndex("permissions_company_code_idx").on(table.companyId, table.code).where(sql`${table.companyId} is not null`),
]);

export const insertPermissionSchema = createInsertSchema(permissionsTable).omit({ id: true, createdAt: true });
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type PermissionRow = typeof permissionsTable.$inferSelect;

import { pgTable, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Assigns a role to a user. branchId null = the grant applies company-wide;
// a non-null branchId scopes it to a single branch (a user can hold different
// roles at different branches via multiple rows). No FK to a branches table
// yet — that lands with the branches module; the column is captured now so
// this table doesn't need a migration when it does.
export const userRolesTable = pgTable("user_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  userId: uuid("user_id").notNull(),
  roleId: uuid("role_id").notNull(),
  branchId: uuid("branch_id"),
  grantedBy: uuid("granted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("user_roles_branch_scoped_idx").on(table.userId, table.roleId, table.branchId)
    .where(sql`${table.branchId} is not null`),
  uniqueIndex("user_roles_company_wide_idx").on(table.userId, table.roleId)
    .where(sql`${table.branchId} is null`),
]);

export const insertUserRoleSchema = createInsertSchema(userRolesTable).omit({ id: true, createdAt: true });
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRolesTable.$inferSelect;

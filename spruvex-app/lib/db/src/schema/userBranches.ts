import { pgTable, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Which branches a user is allowed to log into / select as their current
// working branch (Phase 7). Deliberately separate from userRolesTable's
// branchId column — that one scopes a single ROLE grant to a branch for
// RBAC resolution; this table answers "can this user pick branch X at
// login" and is what the branch-selector UI reads.
export const userBranchesTable = pgTable("user_branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  userId: uuid("user_id").notNull(),
  branchId: uuid("branch_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("user_branches_user_branch_idx").on(table.userId, table.branchId),
]);

export const insertUserBranchSchema = createInsertSchema(userBranchesTable).omit({ id: true, createdAt: true });
export type InsertUserBranch = z.infer<typeof insertUserBranchSchema>;
export type UserBranch = typeof userBranchesTable.$inferSelect;

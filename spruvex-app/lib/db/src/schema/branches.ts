import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A company's physical/logical location. Every tenant gets exactly one
// default branch (isDefault = true) created at signup; multi-branch is a
// paid add-on per PROJECT_VISION (maxBranches on companiesTable already
// gates it) — this table itself has no plan-based restriction, that's
// enforced at the API layer when creating additional branches.
export const branchesTable = pgTable("branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  code: text("code"),
  address: text("address"),
  phone: text("phone"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBranchSchema = createInsertSchema(branchesTable).omit({ id: true, createdAt: true });
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Branch = typeof branchesTable.$inferSelect;

import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companiesTable = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Licensing / subscription — controls trial period, seat/branch limits,
  // and which optional modules a customer has paid for.
  plan: text("plan").notNull().default("trial"), // trial | basic | pro | custom
  status: text("status").notNull().default("active"), // active | suspended
  trialEndsAt: timestamp("trial_ends_at"),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  maxUsers: integer("max_users").notNull().default(3),
  maxBranches: integer("max_branches").notNull().default(1),
  enabledModules: text("enabled_modules").notNull().default('["pos","inventory","customers","repairs"]'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({ id: true, createdAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;

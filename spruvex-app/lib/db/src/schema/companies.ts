import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companiesTable = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  // Licensing / subscription — controls trial period, seat/branch limits,
  // and which optional modules a customer has paid for. Values are this
  // project's SaaS package codes: erp_business | restaurant | sales_repair |
  // enterprise (see PROJECT_VISION_UPDATED.md's commercial packaging model).
  plan: text("plan").notNull().default("erp_business"),
  // The tenant's declared line of business at signup (retail | electronics |
  // repair | restaurant | ecommerce | grocery | cafe | clothing | other) —
  // drives the default enabledModules set and POS template; kept even after
  // signup (editable from the setup wizard / Settings) since it also selects
  // the starter catalog template (see businessCatalogTemplates.ts).
  businessType: text("business_type"),
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

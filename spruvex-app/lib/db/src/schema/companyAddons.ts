import { pgTable, uuid, text, timestamp, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per (company, add-on) the tenant has ever toggled — updated in
// place rather than versioned, since there's no billing history to preserve
// yet (see subscriptions.ts for that). The add-on catalog itself (which
// codes exist, whether each is a module-unlock or a quantity-boost, and what
// it boosts) is a plain code constant next to PERMISSIONS/DEFAULT_ROLES in
// roles.ts — not a DB table — matching this project's existing pattern for
// business config that changes only via a deploy, not tenant data.
export const companyAddonsTable = pgTable("company_addons", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  addonCode: text("addon_code").notNull(),
  // Only meaningful for quantity-type add-ons (e.g. additional_users = 5);
  // null for module-unlock add-ons (e.g. ecommerce).
  quantity: integer("quantity"),
  isActive: boolean("is_active").notNull().default(true),
  activatedAt: timestamp("activated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("company_addons_company_code_idx").on(table.companyId, table.addonCode),
]);

export const insertCompanyAddonSchema = createInsertSchema(companyAddonsTable).omit({ id: true, createdAt: true });
export type InsertCompanyAddon = z.infer<typeof insertCompanyAddonSchema>;
export type CompanyAddon = typeof companyAddonsTable.$inferSelect;

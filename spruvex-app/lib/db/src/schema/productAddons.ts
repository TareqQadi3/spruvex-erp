import { pgTable, uuid, text, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Add-on groups a POS can offer alongside a product at sale time (e.g. "Size"
// required-single-select, "Extras" optional-multi-select) — what the Grid POS
// template (restaurants/cafes) shows as the order-customization sheet.
// productId is nullable: a null group applies to every product in the
// company (e.g. a "Gift wrap" add-on offered store-wide) instead of one.
export const productAddonGroupsTable = pgTable("product_addon_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  productId: uuid("product_id"),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  required: boolean("required").notNull().default(false),
  minSelect: integer("min_select").notNull().default(0),
  maxSelect: integer("max_select").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productAddonOptionsTable = pgTable("product_addon_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  priceDelta: numeric("price_delta", { precision: 10, scale: 2 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductAddonGroupSchema = createInsertSchema(productAddonGroupsTable).omit({ id: true, createdAt: true });
export type InsertProductAddonGroup = z.infer<typeof insertProductAddonGroupSchema>;
export type ProductAddonGroup = typeof productAddonGroupsTable.$inferSelect;

export const insertProductAddonOptionSchema = createInsertSchema(productAddonOptionsTable).omit({ id: true, createdAt: true });
export type InsertProductAddonOption = z.infer<typeof insertProductAddonOptionSchema>;
export type ProductAddonOption = typeof productAddonOptionsTable.$inferSelect;

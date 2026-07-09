import { pgTable, uuid, text, timestamp, numeric, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Tree-capable like categories.ts (Category > Sub-category via self-referencing
// parentId, null = top-level). Deliberately a separate table from the existing
// product `categories` table rather than reusing it — menu categories are a
// distinct concept (course/section grouping for ordering & KDS routing, e.g.
// "Appetizers", "Grilled", "Beverages") from retail product categories, and
// keeping them separate avoids mixing restaurant and retail catalog concerns.
export const menuCategoriesTable = pgTable("menu_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  parentId: uuid("parent_id"),
  sortOrder: numeric("sort_order", { precision: 10, scale: 2 }).notNull().default("0"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMenuCategorySchema = createInsertSchema(menuCategoriesTable).omit({ id: true, createdAt: true });
export type InsertMenuCategory = z.infer<typeof insertMenuCategorySchema>;
export type MenuCategory = typeof menuCategoriesTable.$inferSelect;

// DECISION: productId is optional (nullable), not a forced/required link.
// Most restaurant menu items are recipes (a combination of raw ingredients)
// rather than a single stocked SKU, so forcing a 1:1 link to `products` would
// misrepresent the domain. Businesses that DO want to draw down stock for an
// item that maps directly to a tracked product (e.g. a bottled drink sold
// as-is) can set productId; pure-recipe items simply leave it null. Actual
// recipe/ingredient-consumption tracking (bill-of-materials style) is out of
// scope for this foundation and left for a future module.
//
// `station` is the KDS routing tag (e.g. "grill", "cold_station", "bar",
// "dessert") — a plain text field is sufficient per scope; no separate
// stations-management table.
export const menuItemsTable = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  categoryId: uuid("category_id"),
  productId: uuid("product_id"), // optional link to products.id — see decision note above
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  station: text("station"), // KDS prep-station routing tag, e.g. "grill" | "bar" | "cold_station"
  imageUrl: text("image_url"),
  isAvailable: boolean("is_available").notNull().default(true),
  sortOrder: numeric("sort_order", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMenuItemSchema = createInsertSchema(menuItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItemsTable.$inferSelect;

// A modifier group belongs to a menu item (e.g. "Cheese options" on a burger).
// selectionType constrains how many options a customer can pick — validated
// app-side against MODIFIER_SELECTION_TYPES, same plain-text-enum convention
// used throughout this schema.
export const MODIFIER_SELECTION_TYPES = ["single", "multiple"] as const;
export type ModifierSelectionType = typeof MODIFIER_SELECTION_TYPES[number];

export const menuModifierGroupsTable = pgTable("menu_modifier_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  menuItemId: uuid("menu_item_id").notNull(),
  name: text("name").notNull(), // e.g. "Extras", "Cheese", "Remove"
  selectionType: text("selection_type").$type<ModifierSelectionType>().notNull().default("single"),
  isRequired: boolean("is_required").notNull().default(false),
  sortOrder: numeric("sort_order", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMenuModifierGroupSchema = createInsertSchema(menuModifierGroupsTable).omit({ id: true, createdAt: true });
export type InsertMenuModifierGroup = z.infer<typeof insertMenuModifierGroupSchema>;
export type MenuModifierGroup = typeof menuModifierGroupsTable.$inferSelect;

// A single selectable option within a modifier group (e.g. "Extra cheese",
// "No onions"), with an additive price delta (can be 0 or negative for
// "no X" removals that don't change price).
export const menuModifierOptionsTable = pgTable("menu_modifier_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  modifierGroupId: uuid("modifier_group_id").notNull(),
  name: text("name").notNull(), // e.g. "Extra cheese", "No onions"
  priceDelta: numeric("price_delta", { precision: 10, scale: 2 }).notNull().default("0"),
  isAvailable: boolean("is_available").notNull().default(true),
  sortOrder: numeric("sort_order", { precision: 10, scale: 2 }).notNull().default("0"),
}, (table) => [
  uniqueIndex("menu_modifier_options_group_name_idx").on(table.modifierGroupId, table.name),
]);

export const insertMenuModifierOptionSchema = createInsertSchema(menuModifierOptionsTable).omit({ id: true });
export type InsertMenuModifierOption = z.infer<typeof insertMenuModifierOptionSchema>;
export type MenuModifierOption = typeof menuModifierOptionsTable.$inferSelect;

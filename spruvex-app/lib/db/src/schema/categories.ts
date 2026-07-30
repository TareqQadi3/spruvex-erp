import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const categoriesTable = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  // `name` is the Arabic name (existing data); nameEn is new and optional.
  name: text("name").notNull(),
  nameEn: text("name_en"),
  code: text("code"),
  description: text("description"),
  // Self-referencing FK for Category > Sub-category hierarchies (null = top-level).
  parentId: uuid("parent_id"),
  imageUrl: text("image_url"),
  status: text("status").notNull().default("active"), // active | inactive
  // POS template override for every product in this category (null = fall
  // through to the product's own override, then to settings.posTemplate).
  // Resolution order lives in one place: pos-shared/resolvePosTemplate.ts.
  displayMode: text("display_mode"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true, createdAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;

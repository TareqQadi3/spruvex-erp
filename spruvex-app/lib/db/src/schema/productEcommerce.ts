import { pgTable, uuid, text, timestamp, numeric, boolean, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One-to-one e-commerce extension of a product. Kept in its own table
// (instead of columns on products) so a tenant who never enables the
// e-commerce module carries zero extra columns/clutter on the hot products
// table — the "modular, no complexity for the plain-POS merchant" rule.
export const productEcommerceTable = pgTable("product_ecommerce", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  productId: uuid("product_id").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  storeName: text("store_name"),
  shortDescription: text("short_description"),
  fullDescription: text("full_description"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  seoKeywords: text("seo_keywords"),
  weightKg: numeric("weight_kg", { precision: 10, scale: 3 }),
  dimensions: jsonb("dimensions"), // free-form { length, width, height }; no fixed unit enforced at schema level
  ecommerceCategory: text("ecommerce_category"),
  publishStatus: text("publish_status").notNull().default("draft"), // draft | published | archived
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("product_ecommerce_product_idx").on(table.productId),
]);

export const insertProductEcommerceSchema = createInsertSchema(productEcommerceTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProductEcommerce = z.infer<typeof insertProductEcommerceSchema>;
export type ProductEcommerce = typeof productEcommerceTable.$inferSelect;

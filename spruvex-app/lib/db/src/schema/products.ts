import { pgTable, uuid, text, timestamp, integer, numeric, boolean, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  // `name` is treated as the Arabic name (the primary language for this
  // market and how existing data was entered) — nameEn is the new optional
  // English name, added instead of a third column to avoid a confusing
  // triple-name schema.
  name: text("name").notNull(),
  nameEn: text("name_en"),
  sku: text("sku").notNull(),
  barcode: text("barcode"),
  description: text("description"),
  costPrice: numeric("cost_price", { precision: 10, scale: 2 }).notNull().default("0"),
  sellingPrice: numeric("selling_price", { precision: 10, scale: 2 }).notNull().default("0"),
  // Floor price guard — additional price tiers (wholesale, VIP, seasonal...)
  // live in priceLists.ts (product_prices), not as extra columns here.
  minSellingPrice: numeric("min_selling_price", { precision: 10, scale: 2 }),
  // Variants (e.g. Samsung S25 in black/white x 128GB/256GB): a variant is
  // just another row in this same table with parentProductId pointing at the
  // "master" product. Nothing else changes — sku/barcode/price/stock all
  // already work per-row via existing columns and stockTable, so sales,
  // purchases, and POS need zero changes to support variants.
  parentProductId: uuid("parent_product_id"),
  variantAttributes: jsonb("variant_attributes"), // e.g. { "color": "black", "memory": "128GB" }
  stock: integer("stock").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  categoryId: uuid("category_id"),
  warehouseId: uuid("warehouse_id"),
  sectionId: uuid("section_id"),
  supplierId: uuid("supplier_id"),
  brand: text("brand"),
  imageUrl: text("image_url"),
  includesTax: boolean("includes_tax").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("products_company_sku_idx").on(table.companyId, table.sku),
]);

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;

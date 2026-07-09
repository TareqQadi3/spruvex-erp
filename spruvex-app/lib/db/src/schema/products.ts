import { pgTable, uuid, text, timestamp, integer, numeric, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  barcode: text("barcode"),
  description: text("description"),
  costPrice: numeric("cost_price", { precision: 10, scale: 2 }).notNull().default("0"),
  sellingPrice: numeric("selling_price", { precision: 10, scale: 2 }).notNull().default("0"),
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

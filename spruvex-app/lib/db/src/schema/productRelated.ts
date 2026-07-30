import { pgTable, uuid, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Cross-sell links between independently-stocked products (e.g. iPhone 16 Pro
// -> case, screen protector, charger) — deliberately NOT an add-on: each
// related product has its own SKU/stock/price and is sold as its own sale_item,
// unlike an add-on which is a priced modifier on the parent line. The Mobile
// POS template shows these as one-tap "add accessory" chips beside the variant
// picker.
export const productRelatedProductsTable = pgTable("product_related_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  productId: uuid("product_id").notNull(),
  relatedProductId: uuid("related_product_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("product_related_pair_idx").on(table.productId, table.relatedProductId),
]);

export const insertProductRelatedProductSchema = createInsertSchema(productRelatedProductsTable).omit({ id: true, createdAt: true });
export type InsertProductRelatedProduct = z.infer<typeof insertProductRelatedProductSchema>;
export type ProductRelatedProduct = typeof productRelatedProductsTable.$inferSelect;

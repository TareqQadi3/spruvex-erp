import { pgTable, uuid, text, timestamp, numeric, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A company-defined pricing tier (retail, wholesale, distributor, VIP,
// seasonal...) — deliberately open-ended instead of a fixed set of price
// columns on products, so a tenant can add as many tiers as their business
// needs. A product with no entry in productPricesTable for a given list
// simply falls back to products.sellingPrice.
export const priceListsTable = pgTable("price_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  code: text("code"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// One row per (product, price list) override. validFrom/validTo support a
// time-boxed tier (e.g. a seasonal-offer list) without a separate promotions
// table.
export const productPricesTable = pgTable("product_prices", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  productId: uuid("product_id").notNull(),
  priceListId: uuid("price_list_id").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("product_prices_product_list_idx").on(table.productId, table.priceListId),
]);

export const insertPriceListSchema = createInsertSchema(priceListsTable).omit({ id: true, createdAt: true });
export type InsertPriceList = z.infer<typeof insertPriceListSchema>;
export type PriceList = typeof priceListsTable.$inferSelect;

export const insertProductPriceSchema = createInsertSchema(productPricesTable).omit({ id: true, createdAt: true });
export type InsertProductPrice = z.infer<typeof insertProductPriceSchema>;
export type ProductPrice = typeof productPricesTable.$inferSelect;

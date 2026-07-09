import { pgTable, uuid, text, timestamp, numeric, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Company-defined unit of measure (piece, kg, liter, carton, box...).
export const unitsTable = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  symbol: text("symbol"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A product can be sold/stocked in multiple units (e.g. 1 carton = 12 pieces).
// Stock stays tracked in the product's base unit (stock.quantity, unchanged) —
// conversionFactor says how many base units one of *this* unit equals, so
// selling N of a non-base unit deducts N * conversionFactor from stock. Exactly
// one row per product should have isBaseUnit = true (enforced app-side, like
// every other invariant in this schema).
export const productUnitsTable = pgTable("product_units", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  productId: uuid("product_id").notNull(),
  unitId: uuid("unit_id").notNull(),
  conversionFactor: numeric("conversion_factor", { precision: 12, scale: 4 }).notNull().default("1"),
  isBaseUnit: boolean("is_base_unit").notNull().default(false),
  barcode: text("barcode"),
  sellingPrice: numeric("selling_price", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("product_units_product_unit_idx").on(table.productId, table.unitId),
]);

export const insertUnitSchema = createInsertSchema(unitsTable).omit({ id: true, createdAt: true });
export type InsertUnit = z.infer<typeof insertUnitSchema>;
export type Unit = typeof unitsTable.$inferSelect;

export const insertProductUnitSchema = createInsertSchema(productUnitsTable).omit({ id: true, createdAt: true });
export type InsertProductUnit = z.infer<typeof insertProductUnitSchema>;
export type ProductUnit = typeof productUnitsTable.$inferSelect;

import { pgTable, uuid, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Company-scoped attribute catalog (e.g. "Color", "Storage", "Warranty") used
// to build the variant picker on the Mobile/Electronics and Image POS
// templates. Actual variant rows still live in products.ts (parentProductId +
// variantAttributes jsonb) — this table is the admin-facing "what attributes
// and values exist to choose from" catalog, not the variant data itself.
export const productAttributeDefinitionsTable = pgTable("product_attribute_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("product_attr_defs_company_name_idx").on(table.companyId, table.name),
]);

export const productAttributeValuesTable = pgTable("product_attribute_values", {
  id: uuid("id").primaryKey().defaultRandom(),
  attributeDefinitionId: uuid("attribute_definition_id").notNull(),
  value: text("value").notNull(),
  valueEn: text("value_en"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductAttributeDefinitionSchema = createInsertSchema(productAttributeDefinitionsTable).omit({ id: true, createdAt: true });
export type InsertProductAttributeDefinition = z.infer<typeof insertProductAttributeDefinitionSchema>;
export type ProductAttributeDefinition = typeof productAttributeDefinitionsTable.$inferSelect;

export const insertProductAttributeValueSchema = createInsertSchema(productAttributeValuesTable).omit({ id: true, createdAt: true });
export type InsertProductAttributeValue = z.infer<typeof insertProductAttributeValueSchema>;
export type ProductAttributeValue = typeof productAttributeValuesTable.$inferSelect;

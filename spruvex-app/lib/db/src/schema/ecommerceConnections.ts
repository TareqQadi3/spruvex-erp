import { pgTable, uuid, text, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A tenant's connection to one external sales channel (Salla, Zid, Shopify,
// WooCommerce, or a future SpruVex-hosted storefront). Credentials are opaque
// jsonb here; encryption-at-rest/secret handling is an application concern,
// not modeled at the schema level.
export const ecommerceConnectionsTable = pgTable("ecommerce_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  platform: text("platform").notNull(), // salla | zid | shopify | woocommerce | spruvex_store
  status: text("status").notNull().default("disconnected"), // connected | disconnected | error
  storeUrl: text("store_url"),
  credentials: jsonb("credentials"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Maps a local product to its counterpart on one external channel — the join
// point a future webhook/sync module reads and writes.
export const productExternalMappingsTable = pgTable("product_external_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  productId: uuid("product_id").notNull(),
  connectionId: uuid("connection_id").notNull(),
  externalId: text("external_id").notNull(),
  externalSku: text("external_sku"),
  syncStatus: text("sync_status").notNull().default("pending"), // pending | synced | error
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("product_external_mappings_connection_product_idx").on(table.connectionId, table.productId),
]);

export const insertEcommerceConnectionSchema = createInsertSchema(ecommerceConnectionsTable).omit({ id: true, createdAt: true });
export type InsertEcommerceConnection = z.infer<typeof insertEcommerceConnectionSchema>;
export type EcommerceConnection = typeof ecommerceConnectionsTable.$inferSelect;

export const insertProductExternalMappingSchema = createInsertSchema(productExternalMappingsTable).omit({ id: true, createdAt: true });
export type InsertProductExternalMapping = z.infer<typeof insertProductExternalMappingSchema>;
export type ProductExternalMapping = typeof productExternalMappingsTable.$inferSelect;

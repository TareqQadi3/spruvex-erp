import { pgTable, uuid, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Company-configurable sale fulfillment types (Dine In, Take Away, Delivery,
// Pickup, or any custom one a tenant adds) — not a hardcoded enum, so a new
// business type or a merchant's own workflow never needs a code change.
// sales.orderType stores this row's `key` as plain text (no DB-level FK/enum
// constraint) so historical sales stay valid even if a company later edits or
// removes a type.
export const orderTypesTable = pgTable("order_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  key: text("key").notNull(), // e.g. "dine_in", "takeaway", "custom_catering"
  name: text("name").notNull(),
  nameEn: text("name_en"),
  isSystem: boolean("is_system").notNull().default(false), // seeded default, not user-deletable via UI
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("order_types_company_key_idx").on(table.companyId, table.key),
]);

export const insertOrderTypeSchema = createInsertSchema(orderTypesTable).omit({ id: true, createdAt: true });
export type InsertOrderType = z.infer<typeof insertOrderTypeSchema>;
export type OrderType = typeof orderTypesTable.$inferSelect;

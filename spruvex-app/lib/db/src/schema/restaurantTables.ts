import { pgTable, uuid, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Dining table / floor status. Kept as plain text validated app-side (this
// codebase deliberately avoids native Postgres ENUM — see repairs.ts,
// offlineQueue.ts — so values stay extendable with a plain migration).
export const RESTAURANT_TABLE_STATUSES = [
  "available",
  "occupied",
  "reserved",
  "cleaning",
] as const;
export type RestaurantTableStatus = typeof RESTAURANT_TABLE_STATUSES[number];

// A physical dining table on the floor. No dedicated `branches` table exists
// yet anywhere in this schema (branchId shows up elsewhere — offlineQueue.ts,
// syncLogs.ts — as a loose optional uuid with no backing table), so we follow
// that same convention here rather than inventing branch infrastructure.
// `section` is a plain text label (e.g. "Patio", "Main Hall") instead of a
// separate floor/section table — deliberately not over-normalized per scope.
export const restaurantTablesTable = pgTable("restaurant_tables", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  tableNumber: text("table_number").notNull(),
  name: text("name"),
  section: text("section"),
  seatingCapacity: integer("seating_capacity").notNull().default(2),
  status: text("status").$type<RestaurantTableStatus>().notNull().default("available"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("restaurant_tables_company_number_idx").on(table.companyId, table.tableNumber),
]);

export const insertRestaurantTableSchema = createInsertSchema(restaurantTablesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRestaurantTable = z.infer<typeof insertRestaurantTableSchema>;
export type RestaurantTable = typeof restaurantTablesTable.$inferSelect;

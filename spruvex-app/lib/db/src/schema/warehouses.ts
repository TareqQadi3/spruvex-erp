import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const warehousesTable = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  // "repairs" warehouses are auto-hidden when the repairs module is disabled.
  isRepairStock: boolean("is_repair_stock").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWarehouseSchema = createInsertSchema(warehousesTable).omit({ id: true, createdAt: true });
export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;
export type Warehouse = typeof warehousesTable.$inferSelect;

// Sub-locations within a warehouse (aisle/shelf/bin) — optional finer-grained
// stock location than warehouseId alone.
export const warehouseSectionsTable = pgTable("warehouse_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  warehouseId: uuid("warehouse_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWarehouseSectionSchema = createInsertSchema(warehouseSectionsTable).omit({ id: true, createdAt: true });
export type InsertWarehouseSection = z.infer<typeof insertWarehouseSectionSchema>;
export type WarehouseSection = typeof warehouseSectionsTable.$inferSelect;

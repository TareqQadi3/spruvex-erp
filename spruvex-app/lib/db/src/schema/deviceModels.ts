import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Repair-intake device models, scoped to a brand from the same shared
// `brands` table product creation already uses — one brand catalog for the
// whole company instead of a separate repairs-only concept.
export const deviceModelsTable = pgTable("device_models", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("device_models_brand_name_idx").on(table.brandId, table.name),
]);

export const insertDeviceModelSchema = createInsertSchema(deviceModelsTable).omit({ id: true, createdAt: true });
export type InsertDeviceModel = z.infer<typeof insertDeviceModelSchema>;
export type DeviceModel = typeof deviceModelsTable.$inferSelect;

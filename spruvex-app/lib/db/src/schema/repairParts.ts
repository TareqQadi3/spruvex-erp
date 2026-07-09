import { pgTable, uuid, text, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Parts installed during a repair. Internally the part cost and labor fee are
// tracked separately; the customer invoice shows only the combined line total.
export const repairPartsTable = pgTable("repair_parts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  repairId: uuid("repair_id").notNull(),
  productId: uuid("product_id"), // optional link to inventory
  partName: text("part_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  partCost: numeric("part_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  laborFee: numeric("labor_fee", { precision: 10, scale: 2 }).notNull().default("0"),
});

export const insertRepairPartSchema = createInsertSchema(repairPartsTable).omit({ id: true });
export type InsertRepairPart = z.infer<typeof insertRepairPartSchema>;
export type RepairPart = typeof repairPartsTable.$inferSelect;

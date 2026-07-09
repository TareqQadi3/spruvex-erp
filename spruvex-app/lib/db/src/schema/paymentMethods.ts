import { pgTable, uuid, text, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentMethodsTable = pgTable("payment_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  percentFee: numeric("percent_fee", { precision: 5, scale: 2 }).notNull().default("0"),
  fixedFee: numeric("fixed_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  showFeeToCustomer: boolean("show_fee_to_customer").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethodsTable).omit({ id: true, createdAt: true });
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type PaymentMethod = typeof paymentMethodsTable.$inferSelect;

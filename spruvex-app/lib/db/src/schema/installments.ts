import { pgTable, uuid, text, timestamp, integer, numeric, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Configurable installment plans, e.g. 12 months = 50% interest, 24 = 70%.
export const installmentPlansTable = pgTable("installment_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  months: integer("months").notNull(),
  interestPercent: numeric("interest_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// An installment sale: principal + interest spread across N monthly payments.
export const installmentSalesTable = pgTable("installment_sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  customerId: uuid("customer_id"),
  saleId: uuid("sale_id"),
  principal: numeric("principal", { precision: 10, scale: 2 }).notNull(),
  interestPercent: numeric("interest_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  months: integer("months").notNull(),
  monthlyAmount: numeric("monthly_amount", { precision: 10, scale: 2 }).notNull(),
  downPayment: numeric("down_payment", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("active"), // active | completed | defaulted
  startDate: date("start_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const installmentPaymentsTable = pgTable("installment_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  installmentSaleId: uuid("installment_sale_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: date("due_date").notNull(),
  paidDate: date("paid_date"),
  isPaid: boolean("is_paid").notNull().default(false),
});

export const insertInstallmentPlanSchema = createInsertSchema(installmentPlansTable).omit({ id: true, createdAt: true });
export type InstallmentPlan = typeof installmentPlansTable.$inferSelect;
export type InstallmentSale = typeof installmentSalesTable.$inferSelect;
export type InstallmentPayment = typeof installmentPaymentsTable.$inferSelect;

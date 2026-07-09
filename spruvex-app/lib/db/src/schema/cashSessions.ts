import { pgTable, uuid, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cashSessionsTable = pgTable("cash_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  openingBalance: numeric("opening_balance", { precision: 10, scale: 2 }).notNull().default("0"),
  closingBalance: numeric("closing_balance", { precision: 10, scale: 2 }),
  expectedBalance: numeric("expected_balance", { precision: 10, scale: 2 }),
  totalSales: numeric("total_sales", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
});

export const insertCashSessionSchema = createInsertSchema(cashSessionsTable).omit({ id: true, openedAt: true });
export type InsertCashSession = z.infer<typeof insertCashSessionSchema>;
export type CashSession = typeof cashSessionsTable.$inferSelect;

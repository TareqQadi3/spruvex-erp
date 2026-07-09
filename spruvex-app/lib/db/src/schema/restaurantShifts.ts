import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const RESTAURANT_SHIFT_STATUSES = ["open", "closed"] as const;
export type RestaurantShiftStatus = typeof RESTAURANT_SHIFT_STATUSES[number];

// DECISION: cashSessionId is optional/nullable, not a required 1:1 link to
// cashSessionsTable (cashSessions.ts). Reasons:
//  - Not every restaurant shift operates a till (kitchen/floor/runner staff
//    clock in and out without ever touching cash).
//  - A single cash session can span multiple staff shifts (shift handover
//    mid-session is common in restaurants), so the relationship isn't 1:1
//    even when it does apply.
// When a shift IS for a cashier/POS role, the app can set cashSessionId to
// link it to the till session it was operating during, purely informational
// (no DB-level FK per this codebase's existing convention).
export const restaurantShiftsTable = pgTable("restaurant_shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  userId: uuid("user_id").notNull(), // staff member — users.id
  cashSessionId: uuid("cash_session_id"), // optional link to cash_sessions — see decision note above
  role: text("role"), // free-text role snapshot at shift time, e.g. "waiter", "cashier", "chef"
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  status: text("status").$type<RestaurantShiftStatus>().notNull().default("open"),
  notes: text("notes"),
});

export const insertRestaurantShiftSchema = createInsertSchema(restaurantShiftsTable).omit({ id: true, startedAt: true });
export type InsertRestaurantShift = z.infer<typeof insertRestaurantShiftSchema>;
export type RestaurantShift = typeof restaurantShiftsTable.$inferSelect;

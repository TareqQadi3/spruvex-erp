import { pgTable, uuid, text, timestamp, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Cash receipt (قبض) and payment (صرف) vouchers — manual cash movements
// separate from sales and expenses.
export const vouchersTable = pgTable("vouchers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  voucherNumber: text("voucher_number").notNull(),
  type: text("type").notNull(), // "receipt" (قبض) | "payment" (صرف)
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  party: text("party"), // person/entity the voucher is to/from (free text label)
  // Which control account the ledger posting hits — set from whichever of the
  // three FKs below is present, "other" if none (see resolvePartyType).
  partyType: text("party_type").notNull().default("other"), // customer | supplier | employee | other
  customerId: uuid("customer_id"),
  supplierId: uuid("supplier_id"),
  employeeId: uuid("employee_id"),
  description: text("description"),
  paymentMethod: text("payment_method").notNull().default("cash"),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVoucherSchema = createInsertSchema(vouchersTable).omit({ id: true, voucherNumber: true, createdAt: true });
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type Voucher = typeof vouchersTable.$inferSelect;

import { pgTable, uuid, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Billing history/state for a tenant, kept separate from companiesTable so a
// plan change or failed payment doesn't overwrite the tenant's identity record,
// and so multiple billing periods can be queried over time.
export const subscriptionsTable = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  plan: text("plan").notNull().default("trial"), // trial | basic | pro | custom
  status: text("status").notNull().default("trialing"), // trialing | active | past_due | canceled
  billingCycle: text("billing_cycle").notNull().default("monthly"), // monthly | yearly
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("SAR"),
  paymentGatewayCustomerId: text("payment_gateway_customer_id"),
  paymentGatewaySubscriptionId: text("payment_gateway_subscription_id"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  trialEndsAt: timestamp("trial_ends_at"),
  canceledAt: timestamp("canceled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, createdAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;

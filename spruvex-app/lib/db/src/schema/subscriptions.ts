import { pgTable, uuid, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Billing history/state for a tenant, kept separate from companiesTable so a
// plan change or failed payment doesn't overwrite the tenant's identity record,
// and so multiple billing periods can be queried over time.
export const subscriptionsTable = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  // Same SaaS package vocabulary as companies.plan: erp_business | restaurant
  // | sales_repair | enterprise.
  plan: text("plan").notNull().default("erp_business"),
  // Billing lifecycle: trial | active | expired | suspended | cancelled.
  // Computed/normalized lazily by planLimitsService.resolveSubscriptionStatus
  // (no cron job yet — trial/period expiry is detected on read by comparing
  // trialEndsAt/currentPeriodEnd to now(), pending real payment-gateway
  // webhooks). Legacy rows may still say "trialing"/"canceled" from before
  // this vocabulary was finalized; the resolver treats those as synonyms.
  status: text("status").notNull().default("trial"),
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

import { pgTable, uuid, text, numeric, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// T-15 phase 1 — real affiliate/commission tracking, scoped deliberately:
// - "the sale" a commission is owed on = a new company registering for
//   either SpruVex ERP or SpruVex R (not a retail POS sale inside a tenant).
// - Lives in the ERP database (this repo), not a new standalone service —
//   spruvex-s currently has no backend/database of its own at all (static
//   Vite+React site only), so "a new central service" would mean
//   provisioning a whole new DB + API + hosting decision, not just code.
//   spruvex-s and SpruVex R reach this data ONLY over the HTTP API below —
//   never direct DB access — preserving the cross-product isolation rule
//   in spirit even though the data doesn't literally live in spruvex-s.
// - Payout is fully manual: this table only tracks what's owed and its
//   approve/paid state. No payment integration, no automatic transfer.
export const AFFILIATE_STATUSES = ["active", "inactive"] as const;
export type AffiliateStatus = typeof AFFILIATE_STATUSES[number];

export const affiliatesTable = pgTable("affiliates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  referralCode: text("referral_code").notNull(),
  status: text("status").notNull().default("active"),
  // Percentage of the referred company's plan price (PLAN_CATALOG.priceMonthlySar)
  // paid as commission — snapshotted onto each conversion at report time, so
  // a later rate change never retroactively changes an already-recorded debt.
  commissionRatePercent: numeric("commission_rate_percent", { precision: 5, scale: 2 }).notNull().default("10"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("affiliates_email_idx").on(table.email),
  uniqueIndex("affiliates_referral_code_idx").on(table.referralCode),
]);

export const CONVERSION_PRODUCTS = ["erp", "r"] as const;
export type ConversionProduct = typeof CONVERSION_PRODUCTS[number];

export const CONVERSION_STATUSES = ["pending", "approved", "paid"] as const;
export type ConversionStatus = typeof CONVERSION_STATUSES[number];

// One row per referred company signup. Fully manual review-then-payout: a
// row starts "pending" (captured at signup — a trial start, not necessarily
// a paying customer yet), a platform admin marks it "approved" once the
// referral is judged genuine/converted, then "paid" once actually
// transferred outside this system. commissionAmountSar is computed once at
// report time and never recalculated, even if the affiliate's rate changes
// later.
export const referralConversionsTable = pgTable("referral_conversions", {
  id: uuid("id").primaryKey().defaultRandom(),
  affiliateId: uuid("affiliate_id").notNull(),
  product: text("product").notNull(),
  // Opaque id from the referring product's own database (this ERP's own
  // companies.id when product="erp"; an external string id from SpruVex R
  // when product="r" — no FK, deliberately: cross-product, no shared table).
  externalCompanyId: text("external_company_id").notNull(),
  companyName: text("company_name").notNull(),
  planCode: text("plan_code").notNull(),
  subscriptionValueSar: numeric("subscription_value_sar", { precision: 10, scale: 2 }).notNull(),
  commissionRatePercent: numeric("commission_rate_percent", { precision: 5, scale: 2 }).notNull(),
  commissionAmountSar: numeric("commission_amount_sar", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  reportedAt: timestamp("reported_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
}, (table) => [
  index("referral_conversions_affiliate_idx").on(table.affiliateId),
  // A single referred company shouldn't be reported twice for the same
  // product (e.g. a retried webhook call) — first report wins.
  uniqueIndex("referral_conversions_product_company_idx").on(table.product, table.externalCompanyId),
]);

export const insertAffiliateSchema = createInsertSchema(affiliatesTable).omit({ id: true, createdAt: true });
export type InsertAffiliate = z.infer<typeof insertAffiliateSchema>;
export type Affiliate = typeof affiliatesTable.$inferSelect;

export const insertReferralConversionSchema = createInsertSchema(referralConversionsTable).omit({ id: true, reportedAt: true });
export type InsertReferralConversion = z.infer<typeof insertReferralConversionSchema>;
export type ReferralConversion = typeof referralConversionsTable.$inferSelect;

import { pgTable, uuid, text, timestamp, numeric, boolean, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Which payment backends exist. "moyasar" is the PSP through which mada (and
// Visa/Mastercard) card payments are processed — mada is a card network, not
// an API, so it rides on a PSP. "mock" is a real registered provider
// (deterministic, no network, no key) — same convention as AI_PROVIDERS:
// keeps dev/tests runnable without merchant accounts and proves the provider
// layer isn't hard-wired to one vendor.
export const PAYMENT_PROVIDERS = ["tabby", "tamara", "moyasar", "mock"] as const;
export type PaymentProviderName = typeof PAYMENT_PROVIDERS[number];

// Per-company, per-gateway configuration. A company may hold several rows
// (Tabby AND Tamara AND Moyasar). Credentials are opaque jsonb (keys differ
// per gateway: secret key, public key, webhook secret/token, merchant code)
// and are NEVER returned by the API — same plaintext-at-rest tradeoff as
// ai_settings.apiKey; encryption is a deployment-phase concern.
export const paymentGatewaySettingsTable = pgTable("payment_gateway_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  provider: text("provider").notNull(),
  credentials: jsonb("credentials"),
  mode: text("mode").notNull().default("test"), // test | live
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("payment_gateway_settings_company_provider_idx").on(table.companyId, table.provider),
]);

// One row per payment attempt against a gateway. The amount is always derived
// server-side from the source record (a sale's outstanding balance or a staged
// ecommerce order's total) — never taken from the client. externalId is the
// gateway's own payment/session id; webhooks resolve back to this row through
// (provider, externalId).
export const paymentTransactionsTable = pgTable("payment_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  provider: text("provider").notNull(),
  source: text("source").notNull(), // sale | ecommerce_order
  sourceId: uuid("source_id").notNull(),
  // Set when source = "sale" (and later when an imported ecommerce order's
  // payment is reconciled) so payment→sale reporting never needs to branch
  // on source type.
  saleId: uuid("sale_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("SAR"),
  status: text("status").notNull().default("created"), // created | pending | captured | failed | cancelled | refunded
  externalId: text("external_id"),
  checkoutUrl: text("checkout_url"),
  idempotencyKey: text("idempotency_key"),
  errorMessage: text("error_message"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("payment_transactions_company_created_idx").on(table.companyId, table.createdAt),
  // Multiple NULL externalIds are allowed (rows that failed before the
  // gateway call succeeded); once set, a gateway id maps to exactly one row.
  uniqueIndex("payment_transactions_provider_external_idx").on(table.provider, table.externalId),
  uniqueIndex("payment_transactions_company_idempotency_idx").on(table.companyId, table.idempotencyKey),
]);

export const insertPaymentGatewaySettingsSchema = createInsertSchema(paymentGatewaySettingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaymentGatewaySettings = z.infer<typeof insertPaymentGatewaySettingsSchema>;
export type PaymentGatewaySettings = typeof paymentGatewaySettingsTable.$inferSelect;

export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaymentTransaction = z.infer<typeof insertPaymentTransactionSchema>;
export type PaymentTransaction = typeof paymentTransactionsTable.$inferSelect;

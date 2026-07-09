import { pgTable, uuid, text, timestamp, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Which AI backends exist. "mock" is a real registered provider (deterministic
// canned output, no network, no key) — it keeps dev/tests runnable without a
// paid key and proves the provider layer isn't hard-wired to one vendor.
export const AI_PROVIDERS = ["anthropic", "mock"] as const;
export type AiProviderName = typeof AI_PROVIDERS[number];

// Per-company AI configuration. A company without a row (or with apiKey null)
// falls back to the platform-level env key (ANTHROPIC_API_KEY) — BYOK is
// optional, not required. apiKey is stored as-is for now and never returned
// by the API (masked); at-rest encryption is a deployment-phase concern.
export const aiSettingsTable = pgTable("ai_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  provider: text("provider").notNull().default("anthropic"),
  // null = use the provider's default model (chosen in code, not per-tenant)
  model: text("model"),
  apiKey: text("api_key"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ai_settings_company_idx").on(table.companyId),
]);

export const insertAiSettingsSchema = createInsertSchema(aiSettingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiSettings = z.infer<typeof insertAiSettingsSchema>;
export type AiSettings = typeof aiSettingsTable.$inferSelect;

// One row per AI call — usage/billing foundation and debugging trail.
// feature is a short code like "product_description" | "improve_name" |
// "suggest_category" | "suggest_keywords" | "ecommerce_description" |
// "business_summary".
export const aiUsageLogsTable = pgTable("ai_usage_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  userId: uuid("user_id").notNull(),
  feature: text("feature").notNull(),
  provider: text("provider").notNull(),
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  status: text("status").notNull().default("success"), // success | error
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAiUsageLogSchema = createInsertSchema(aiUsageLogsTable).omit({ id: true, createdAt: true });
export type InsertAiUsageLog = z.infer<typeof insertAiUsageLogSchema>;
export type AiUsageLog = typeof aiUsageLogsTable.$inferSelect;

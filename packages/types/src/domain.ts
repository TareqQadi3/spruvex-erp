/** Shared domain enums/types used across API and frontend apps. */

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TYPES = ["dine_in", "takeaway_link", "pos_walkin"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_SOURCES = ["qr", "external_link", "pos"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const TENANT_STATUSES = ["active", "suspended"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = ["trial", "active", "past_due", "suspended"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export type Locale = "ar" | "en";

/** Bilingual text value — Arabic first. */
export interface LocalizedText {
  ar: string;
  en: string;
}

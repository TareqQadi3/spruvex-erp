import type { Company, CompanyAddon, PlanLimits, Subscription } from "@workspace/db";

// Billing lifecycle vocabulary — see subscriptions.ts's status column comment.
// Legacy "trialing"/"canceled" rows are normalized to "trial"/"cancelled" by
// resolveSubscriptionStatus before this type is ever produced.
export type SubscriptionStatus = "trial" | "active" | "expired" | "suspended" | "cancelled";

// The single resolved view of "what can this company do right now" — returned
// by planLimitsService.getEffectiveState and consumed by every middleware/route
// that needs to gate a feature or a limit. Nothing downstream should ever
// re-derive status/modules/limits itself.
export interface EffectiveState {
  company: Company;
  subscription: Subscription | null;
  status: SubscriptionStatus;
  effectiveModules: string[];
  effectiveLimits: PlanLimits;
  activeAddons: CompanyAddon[];
}

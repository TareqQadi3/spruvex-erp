import {
  ADDON_CATALOG,
  PLAN_CATALOG,
  type AddonCode,
  type Company,
  type CompanyAddon,
  type PlanCode,
  type PlanLimits,
} from "@workspace/db";
import { AppError } from "../../../core/errors/AppError";
import type { DbOrTx } from "../../../core/database/transaction";
import { subscriptionsRepository } from "../repositories/subscriptionsRepository";
import type { EffectiveState, SubscriptionStatus } from "../types/subscriptions.types";

function normalizeStatus(raw: string): SubscriptionStatus {
  // Legacy vocabulary from before the trial|active|expired|suspended|cancelled
  // set was finalized — see subscriptions.ts's status column comment.
  if (raw === "trialing") return "trial";
  if (raw === "canceled") return "cancelled";
  return raw as SubscriptionStatus;
}

// Pure — no DB access. A platform-level suspension always wins regardless of
// subscription state; otherwise trial/active periods are checked against
// their end dates lazily on read (no cron job driving this yet).
export function resolveSubscriptionStatus(
  subscription: { status: string; trialEndsAt: Date | null; currentPeriodEnd: Date | null } | null,
  companyStatus: "active" | "suspended",
): SubscriptionStatus {
  if (companyStatus === "suspended") return "suspended";

  // Every company gets a subscription row at signup (see authService.registerCompany);
  // a missing one is an anomaly worth blocking on, not silently allowing.
  if (!subscription) return "expired";

  const normalized = normalizeStatus(subscription.status);
  if (normalized === "cancelled") return "cancelled";

  const now = Date.now();
  if (normalized === "trial" && subscription.trialEndsAt && subscription.trialEndsAt.getTime() < now) {
    return "expired";
  }
  if (normalized === "active" && subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() < now) {
    return "expired";
  }

  return normalized;
}

export async function getActiveAddons(companyId: string, client?: DbOrTx): Promise<CompanyAddon[]> {
  return subscriptionsRepository.findActiveAddons(companyId, client);
}

// Pure — union of the plan's default modules, the company's own
// enabledModules (set from businessType at signup, or widened by a platform
// plan change), and every active module-type add-on's granted module.
export function resolveEffectiveModules(company: Company, activeAddons: CompanyAddon[]): string[] {
  const plan = PLAN_CATALOG[company.plan as PlanCode];
  const planModules = plan?.modules ?? [];

  let companyModules: string[] = [];
  try {
    companyModules = JSON.parse(company.enabledModules ?? "[]");
  } catch {
    companyModules = [];
  }

  const addonModules = activeAddons
    .map((addon) => ADDON_CATALOG[addon.addonCode as AddonCode])
    .filter((def): def is Extract<typeof def, { type: "module" }> => def?.type === "module")
    .map((def) => def.grantsModule);

  return Array.from(new Set([...planModules, ...companyModules, ...addonModules]));
}

// Pure — starts from the plan's catalog limits, applies the company's own
// maxUsers/maxBranches override columns (always present — NOT NULL with a
// default — so this is an unconditional override, not a nullable one), then
// adds every active quantity-type add-on's quantity onto the limit it boosts.
export function resolveEffectiveLimits(company: Company, activeAddons: CompanyAddon[]): PlanLimits {
  const plan = PLAN_CATALOG[company.plan as PlanCode];
  const limits: PlanLimits = plan
    ? { ...plan }
    : {
        maxUsers: 0, maxBranches: 0, maxProducts: 0, maxCustomers: 0,
        maxInvoicesPerMonth: 0, storageQuotaMb: 0, maxAiRequestsPerMonth: 0, modules: [],
        // Display fields (added to PlanLimits in Phase 6 for the public
        // pricing endpoint) — meaningless for an unknown plan code.
        nameAr: "", nameEn: "", taglineAr: "", taglineEn: "", priceMonthlySar: null,
      };

  limits.maxUsers = company.maxUsers;
  limits.maxBranches = company.maxBranches;

  for (const addon of activeAddons) {
    const def = ADDON_CATALOG[addon.addonCode as AddonCode];
    if (def?.type === "quantity") {
      const current = limits[def.boostsLimit];
      if (typeof current === "number") {
        (limits[def.boostsLimit] as number) = current + (addon.quantity ?? 0);
      }
    }
  }

  return limits;
}

export async function countCurrentUsersForCompany(companyId: string): Promise<number> {
  return subscriptionsRepository.countActiveUsers(companyId);
}

// The single source of truth every middleware/route calls — loads the
// company, its latest subscription, and its active add-ons, and resolves all
// of status/effectiveModules/effectiveLimits together. Nothing else should
// reimplement this resolution.
export async function getEffectiveState(companyId: string, client?: DbOrTx): Promise<EffectiveState> {
  const company = await subscriptionsRepository.findCompanyById(companyId, client);
  if (!company) throw AppError.notFound("Company not found");

  const subscription = await subscriptionsRepository.findLatestSubscription(companyId, client);
  const activeAddons = await subscriptionsRepository.findActiveAddons(companyId, client);

  const status = resolveSubscriptionStatus(
    subscription
      ? { status: subscription.status, trialEndsAt: subscription.trialEndsAt, currentPeriodEnd: subscription.currentPeriodEnd }
      : null,
    company.status as "active" | "suspended",
  );

  return {
    company,
    subscription,
    status,
    effectiveModules: resolveEffectiveModules(company, activeAddons),
    effectiveLimits: resolveEffectiveLimits(company, activeAddons),
    activeAddons,
  };
}

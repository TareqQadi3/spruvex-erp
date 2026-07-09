import { PLAN_CATALOG, type AddonCode, type Company, type CompanyAddon, type PlanCode } from "@workspace/db";
import { AppError } from "../../../core/errors/AppError";
import { withTransaction } from "../../../core/database/transaction";
import { platformRepository } from "../repositories/platformRepository";
import { subscriptionsRepository } from "../../subscriptions/repositories/subscriptionsRepository";
import type { CompanySummary } from "../types/platform.types";

function parseEnabledModules(raw: string | null): string[] {
  try {
    return JSON.parse(raw ?? "[]");
  } catch {
    return [];
  }
}

// Reads the latest subscription + active add-ons fresh via subscriptionsRepository
// (single source of truth, same repository planLimitsService.getEffectiveState uses)
// rather than duplicating those queries here.
async function toCompanySummary(company: Company): Promise<CompanySummary> {
  const [subscription, activeAddons] = await Promise.all([
    subscriptionsRepository.findLatestSubscription(company.id),
    subscriptionsRepository.findActiveAddons(company.id),
  ]);

  return {
    id: company.id,
    name: company.name,
    plan: company.plan,
    businessType: company.businessType,
    status: company.status as "active" | "suspended",
    trialEndsAt: company.trialEndsAt,
    subscriptionStatus: subscription?.status ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    activeAddonCodes: activeAddons.map((addon) => addon.addonCode),
  };
}

export async function listCompanies(): Promise<CompanySummary[]> {
  const companies = await platformRepository.listCompanies();
  return Promise.all(companies.map(toCompanySummary));
}

export async function getCompany(companyId: string): Promise<CompanySummary> {
  const company = await platformRepository.findCompanyById(companyId);
  if (!company) throw AppError.notFound("Company not found");
  return toCompanySummary(company);
}

// Upgrading (or changing) plan never removes a module the tenant already
// has — enabledModules is set to the union of its current value and the new
// plan's default modules, never overwritten outright. Also updates the
// company's latest subscription row's plan so both stay in sync.
export async function changePlan(companyId: string, plan: PlanCode): Promise<CompanySummary> {
  const updatedCompany = await withTransaction(async (tx) => {
    const company = await platformRepository.findCompanyById(companyId, tx);
    if (!company) throw AppError.notFound("Company not found");

    const currentModules = parseEnabledModules(company.enabledModules);
    const planModules = PLAN_CATALOG[plan].modules;
    const unionModules = Array.from(new Set([...currentModules, ...planModules]));

    const updated = await platformRepository.updateCompanyPlanAndModules(
      companyId,
      { plan, enabledModules: JSON.stringify(unionModules) },
      tx,
    );
    if (!updated) throw AppError.notFound("Company not found");

    const subscription = await subscriptionsRepository.findLatestSubscription(companyId, tx);
    if (subscription) {
      await platformRepository.updateSubscriptionPlan(subscription.id, plan, tx);
    }

    return updated;
  });

  return toCompanySummary(updatedCompany);
}

export async function changeStatus(companyId: string, status: "active" | "suspended"): Promise<CompanySummary> {
  const updated = await platformRepository.updateCompanyStatus(companyId, status);
  if (!updated) throw AppError.notFound("Company not found");
  return toCompanySummary(updated);
}

// Manual renewal — the only way an expired/cancelled subscription becomes
// active again until a payment gateway drives this. Sets status "active" and
// pushes currentPeriodEnd out periodDays from now.
export async function renewSubscription(companyId: string, periodDays: number): Promise<CompanySummary> {
  const company = await platformRepository.findCompanyById(companyId);
  if (!company) throw AppError.notFound("Company not found");

  const subscription = await subscriptionsRepository.findLatestSubscription(companyId);
  if (!subscription) throw AppError.notFound("Company has no subscription to renew");

  const currentPeriodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);
  await platformRepository.renewSubscription(subscription.id, { status: "active", currentPeriodEnd });

  return toCompanySummary(company);
}

export async function upsertAddon(
  companyId: string,
  addonCode: AddonCode,
  input: { isActive: boolean; quantity?: number },
): Promise<CompanyAddon> {
  const company = await platformRepository.findCompanyById(companyId);
  if (!company) throw AppError.notFound("Company not found");

  const quantity = input.quantity ?? null;
  const existing = await platformRepository.findCompanyAddon(companyId, addonCode);

  if (existing) {
    const updated = await platformRepository.updateCompanyAddon(companyId, addonCode, {
      isActive: input.isActive,
      quantity,
    });
    if (!updated) throw AppError.internal("Failed to update add-on");
    return updated;
  }

  return platformRepository.insertCompanyAddon({
    companyId,
    addonCode,
    isActive: input.isActive,
    quantity,
  });
}

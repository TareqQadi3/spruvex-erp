import { describe, it, expect } from "vitest";
import { PLAN_CATALOG, type Company, type CompanyAddon } from "@workspace/db";
import { resolveSubscriptionStatus, resolveEffectiveModules, resolveEffectiveLimits } from "./planLimitsService";

// T-08: deeper coverage of the subscription/plan resolution logic than the
// original planLimitsService.unit.test.ts file — edge semantics of the three
// pure functions that every requireModule/requireActiveSubscription/
// requireWithinLimit gate in the app depends on.

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: "company-1",
    name: "Test Co",
    plan: "erp_business",
    businessType: "retail",
    status: "active",
    trialEndsAt: null,
    subscriptionEndsAt: null,
    maxUsers: 5,
    maxBranches: 2,
    enabledModules: '["pos","inventory","customers"]',
    createdAt: new Date(),
    ...overrides,
  } as Company;
}

function makeAddon(addonCode: string, overrides: Partial<CompanyAddon> = {}): CompanyAddon {
  return {
    id: "addon-1",
    companyId: "company-1",
    addonCode,
    quantity: null,
    isActive: true,
    activatedAt: new Date(),
    ...overrides,
  } as CompanyAddon;
}

const future = () => new Date(Date.now() + 100000);
const past = () => new Date(Date.now() - 100000);

describe("resolveSubscriptionStatus — edge semantics (pure)", () => {
  it("a platform suspension wins even over a cancelled subscription", () => {
    const status = resolveSubscriptionStatus(
      { status: "cancelled", trialEndsAt: null, currentPeriodEnd: future() },
      "suspended",
    );
    expect(status).toBe("suspended");
  });

  it("a platform suspension wins even when the subscription row is missing", () => {
    expect(resolveSubscriptionStatus(null, "suspended")).toBe("suspended");
  });

  it("a cancelled subscription never reverts, even with future dates and an active company", () => {
    const status = resolveSubscriptionStatus(
      { status: "cancelled", trialEndsAt: future(), currentPeriodEnd: future() },
      "active",
    );
    expect(status).toBe("cancelled");
  });

  it("a subscription row whose own status is suspended blocks an otherwise-active company", () => {
    const status = resolveSubscriptionStatus(
      { status: "suspended", trialEndsAt: null, currentPeriodEnd: future() },
      "active",
    );
    expect(status).toBe("suspended");
  });

  it("a trial with no trialEndsAt is never auto-expired by time", () => {
    const status = resolveSubscriptionStatus(
      { status: "trialing", trialEndsAt: null, currentPeriodEnd: null },
      "active",
    );
    expect(status).toBe("trial");
  });

  it("an active subscription with no currentPeriodEnd is never auto-expired by time", () => {
    const status = resolveSubscriptionStatus(
      { status: "active", trialEndsAt: null, currentPeriodEnd: null },
      "active",
    );
    expect(status).toBe("active");
  });

  it("only legacy vocabulary is normalized — unknown status strings pass through untouched", () => {
    const status = resolveSubscriptionStatus(
      { status: "past_due", trialEndsAt: null, currentPeriodEnd: future() },
      "active",
    );
    expect(status).toBe("past_due");
  });
});

describe("resolveEffectiveModules — union semantics (pure)", () => {
  it("de-duplicates plan, company, and add-on modules into a single set", () => {
    const company = makeCompany({ plan: "erp_business", enabledModules: '["pos","repairs"]' });
    const modules = resolveEffectiveModules(company, [
      makeAddon("ai_features"),
      makeAddon("ecommerce"),
    ]);
    expect(modules).toEqual(
      expect.arrayContaining(["pos", "inventory", "customers", "repairs", "ai_features", "ecommerce"]),
    );
    expect(modules.filter((m) => m === "pos")).toHaveLength(1);
  });

  it("duplicate module-type add-ons collapse to a single grant", () => {
    const company = makeCompany({ enabledModules: "[]" });
    const modules = resolveEffectiveModules(company, [makeAddon("ai_features"), makeAddon("ai_features")]);
    expect(modules.filter((m) => m === "ai_features")).toHaveLength(1);
  });

  it("an unknown plan code still unions the company's own and add-on modules", () => {
    const company = makeCompany({ plan: "not_a_real_plan", enabledModules: '["pos"]' });
    const modules = resolveEffectiveModules(company, [makeAddon("ai_features")]);
    expect(modules).toEqual(["pos", "ai_features"]);
  });

  it("an unknown add-on code is ignored without throwing", () => {
    const company = makeCompany({ enabledModules: '["pos"]' });
    const modules = resolveEffectiveModules(company, [makeAddon("not_a_real_addon")]);
    expect(modules).toEqual(["pos", "inventory", "customers"]);
  });

  it("null/undefined enabledModules degrades to empty and still yields plan + add-on modules", () => {
    const company = makeCompany({ enabledModules: undefined });
    const modules = resolveEffectiveModules(company, [makeAddon("ai_features")]);
    expect(modules).toEqual(expect.arrayContaining(["pos", "inventory", "customers", "ai_features"]));
  });
});

describe("resolveEffectiveLimits — plan defaults + overrides + add-on stacking (pure)", () => {
  it("company overrides win even when they tighten below the plan default", () => {
    const company = makeCompany({ plan: "erp_business", maxBranches: 1 });
    const limits = resolveEffectiveLimits(company, []);
    expect(limits.maxBranches).toBe(1);
  });

  it("non-overridden plan limits are preserved from the catalog unchanged", () => {
    const limits = resolveEffectiveLimits(makeCompany({ plan: "erp_business" }), []);
    expect(limits.maxProducts).toBe(PLAN_CATALOG.erp_business.maxProducts);
    expect(limits.maxInvoicesPerMonth).toBe(PLAN_CATALOG.erp_business.maxInvoicesPerMonth);
    expect(limits.storageQuotaMb).toBe(PLAN_CATALOG.erp_business.storageQuotaMb);
    expect(limits.modules).toEqual(PLAN_CATALOG.erp_business.modules);
    expect(limits.maxAiRequestsPerMonth).toBe(PLAN_CATALOG.erp_business.maxAiRequestsPerMonth);
  });

  it("add-on stacking never mutates the shared plan catalog", () => {
    const company = makeCompany({ plan: "erp_business", maxUsers: 5, maxBranches: 2 });
    const limits = resolveEffectiveLimits(company, [makeAddon("additional_users", { quantity: 3 })]);
    expect(limits.maxUsers).toBe(8);
    expect(PLAN_CATALOG.erp_business.maxUsers).toBe(5);
  });

  it("each call returns an independent result object", () => {
    const company = makeCompany({ plan: "erp_business" });
    const first = resolveEffectiveLimits(company, []);
    const second = resolveEffectiveLimits(company, []);
    first.maxUsers = 999;
    expect(second.maxUsers).toBe(PLAN_CATALOG.erp_business.maxUsers);
  });

  it("an unknown plan still honors company overrides and add-on boosts on top of zeroed defaults", () => {
    const company = makeCompany({ plan: "not_a_real_plan", maxUsers: 3, maxBranches: 1 });
    const limits = resolveEffectiveLimits(company, [
      makeAddon("additional_users", { quantity: 2 }),
      makeAddon("additional_branches", { quantity: 1 }),
    ]);
    expect(limits.maxUsers).toBe(5);
    expect(limits.maxBranches).toBe(2);
    expect(limits.maxProducts).toBe(0);
  });

  it("a quantity add-on with a null quantity boosts nothing", () => {
    const company = makeCompany({ maxUsers: 5, maxBranches: 2 });
    const limits = resolveEffectiveLimits(company, [makeAddon("additional_users")]);
    expect(limits.maxUsers).toBe(5);
  });

  it("an unknown add-on code is ignored during limit resolution", () => {
    const company = makeCompany({ maxUsers: 5, maxBranches: 2 });
    const limits = resolveEffectiveLimits(company, [makeAddon("not_a_real_addon", { quantity: 9 })]);
    expect(limits.maxUsers).toBe(5);
    expect(limits.maxBranches).toBe(2);
  });
});

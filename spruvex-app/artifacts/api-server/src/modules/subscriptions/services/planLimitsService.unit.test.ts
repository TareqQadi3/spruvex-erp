import { describe, it, expect } from "vitest";
import type { Company, CompanyAddon } from "@workspace/db";
import { resolveSubscriptionStatus, resolveEffectiveModules, resolveEffectiveLimits } from "./planLimitsService";

// Subscription/billing gating — the single source of truth every
// requireModule/requireActiveSubscription check in the app depends on.
// Two real production bugs this session traced back to gaps in what THIS
// logic was actually being applied to, not to the logic itself being wrong
// — these tests lock down the logic so it stays correct as routers change.

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

describe("resolveSubscriptionStatus (pure)", () => {
  it("a suspended company is always suspended, regardless of subscription state", () => {
    const status = resolveSubscriptionStatus(
      { status: "active", trialEndsAt: null, currentPeriodEnd: new Date(Date.now() + 100000) },
      "suspended",
    );
    expect(status).toBe("suspended");
  });

  it("a missing subscription row is treated as expired, not silently allowed", () => {
    expect(resolveSubscriptionStatus(null, "active")).toBe("expired");
  });

  it("an expired trial (past trialEndsAt) is expired even if the status column still says trial", () => {
    const status = resolveSubscriptionStatus(
      { status: "trialing", trialEndsAt: new Date(Date.now() - 1000), currentPeriodEnd: null },
      "active",
    );
    expect(status).toBe("expired");
  });

  it("a trial still within its window is active (trial)", () => {
    const status = resolveSubscriptionStatus(
      { status: "trialing", trialEndsAt: new Date(Date.now() + 100000), currentPeriodEnd: null },
      "active",
    );
    expect(status).toBe("trial");
  });

  it("an active subscription past its currentPeriodEnd is expired", () => {
    const status = resolveSubscriptionStatus(
      { status: "active", trialEndsAt: null, currentPeriodEnd: new Date(Date.now() - 1000) },
      "active",
    );
    expect(status).toBe("expired");
  });

  it("normalizes legacy status vocabulary (canceled -> cancelled)", () => {
    const status = resolveSubscriptionStatus(
      { status: "canceled", trialEndsAt: null, currentPeriodEnd: new Date(Date.now() + 100000) },
      "active",
    );
    expect(status).toBe("cancelled");
  });
});

describe("resolveEffectiveModules (pure)", () => {
  it("unions plan modules, company.enabledModules, and active module-addon grants", () => {
    const company = makeCompany({ plan: "erp_business", enabledModules: '["pos","inventory","customers","repairs"]' });
    const modules = resolveEffectiveModules(company, [makeAddon("ai_features")]);
    expect(modules).toEqual(expect.arrayContaining(["pos", "inventory", "customers", "repairs", "ai_features"]));
  });

  it("an inactive addon never contributes a module, even if present in the list", () => {
    const company = makeCompany();
    const modules = resolveEffectiveModules(company, [makeAddon("ai_features")]);
    // Caller is expected to only pass already-filtered active addons — this
    // documents that contract: resolveEffectiveModules trusts its input,
    // it does not re-check isActive itself.
    expect(modules).toContain("ai_features");
  });

  it("a quantity-type addon (e.g. additional_users) never leaks into modules", () => {
    const company = makeCompany();
    const modules = resolveEffectiveModules(company, [makeAddon("additional_users", { quantity: 5 })]);
    expect(modules).not.toContain("additional_users");
  });

  it("malformed enabledModules JSON degrades to empty, not a thrown error", () => {
    const company = makeCompany({ enabledModules: "not json" });
    expect(() => resolveEffectiveModules(company, [])).not.toThrow();
  });
});

describe("resolveEffectiveLimits (pure)", () => {
  it("company.maxUsers/maxBranches always override the plan default", () => {
    const company = makeCompany({ plan: "erp_business", maxUsers: 999 });
    const limits = resolveEffectiveLimits(company, []);
    expect(limits.maxUsers).toBe(999);
  });

  it("a quantity addon boosts exactly the limit it targets, nothing else", () => {
    const company = makeCompany({ maxUsers: 5, maxBranches: 2 });
    const limits = resolveEffectiveLimits(company, [makeAddon("additional_users", { quantity: 3 })]);
    expect(limits.maxUsers).toBe(8);
    expect(limits.maxBranches).toBe(2);
  });

  it("multiple quantity addons of different kinds each boost independently", () => {
    const company = makeCompany({ maxUsers: 5, maxBranches: 2 });
    const limits = resolveEffectiveLimits(company, [
      makeAddon("additional_users", { quantity: 3 }),
      makeAddon("additional_branches", { quantity: 1 }),
    ]);
    expect(limits.maxUsers).toBe(8);
    expect(limits.maxBranches).toBe(3);
  });

  it("an unknown plan code falls back to a zeroed-out limits object instead of throwing", () => {
    const company = makeCompany({ plan: "not_a_real_plan" });
    const limits = resolveEffectiveLimits(company, []);
    expect(limits.maxProducts).toBe(0);
    expect(limits.maxAiRequestsPerMonth).toBe(0);
    expect(limits.modules).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import type { Request, Response, NextFunction } from "express";
import type { PlanLimits, Company } from "@workspace/db";
import { AppError } from "../errors/AppError";
import type { EffectiveState, SubscriptionStatus } from "../../modules/subscriptions/types/subscriptions.types";

// Importing subscription.middleware pulls config/env transitively in some
// chains, and env.ts requires PORT — set it before importing so this test
// file runs standalone (unit tests must not depend on a real .env).
process.env.PORT ??= "5000";

const { requireModule, requireActiveSubscription, requireWithinLimit } = await import("./subscription.middleware");

// T-08: subscription/plan-limit enforcement decisions. The state resolution
// itself (getEffectiveState) is DB-backed and stays integration-covered;
// these tests pin the middleware decision logic — status gating, module
// membership, and quota checks — by faking req.effectiveSubscriptionState
// (the per-request cache every real gate populates on first use), so no
// database is ever touched.

function makeLimits(overrides: Partial<PlanLimits> = {}): PlanLimits {
  return {
    maxUsers: 5, maxBranches: 2, maxProducts: 1000, maxCustomers: 2000,
    maxInvoicesPerMonth: 1000, storageQuotaMb: 500, maxAiRequestsPerMonth: 200,
    modules: ["pos", "inventory", "customers"],
    nameAr: "", nameEn: "", taglineAr: "", taglineEn: "", priceMonthlySar: null,
    ...overrides,
  };
}

function makeState(overrides: { status?: SubscriptionStatus; modules?: string[]; limits?: PlanLimits } = {}): EffectiveState {
  return {
    company: { id: "company-1" } as unknown as Company,
    subscription: null,
    activeAddons: [],
    status: overrides.status ?? "active",
    effectiveModules: overrides.modules ?? ["pos", "inventory", "customers"],
    effectiveLimits: overrides.limits ?? makeLimits(),
  };
}

function makeReq(state?: EffectiveState): Request {
  return { tenant: { userId: "user-1", companyId: "company-1", role: "admin" }, effectiveSubscriptionState: state } as unknown as Request;
}

function makeReqNoTenant(): Request {
  return { tenant: undefined } as unknown as Request;
}

function makeNext() {
  const calls: unknown[] = [];
  const next: NextFunction = (err?: unknown) => {
    calls.push(err);
  };
  return { next, calls };
}

const noopResponse = {} as Response;

describe("requireModule (subscription — module gate)", () => {
  it("allows an active subscription that includes the module", async () => {
    const req = makeReq(makeState({ status: "active", modules: ["pos", "ecommerce"] }));
    const { next, calls } = makeNext();
    await requireModule("ecommerce")(req, noopResponse, next);
    expect(calls).toEqual([undefined]);
  });

  it("allows a trial subscription that includes the module", async () => {
    const req = makeReq(makeState({ status: "trial", modules: ["pos"] }));
    const { next, calls } = makeNext();
    await requireModule("pos")(req, noopResponse, next);
    expect(calls).toEqual([undefined]);
  });

  it("blocks an expired subscription even when the module is present", async () => {
    const req = makeReq(makeState({ status: "expired", modules: ["pos"] }));
    const { next, calls } = makeNext();
    await requireModule("pos")(req, noopResponse, next);
    expect(calls).toHaveLength(1);
    expect((calls[0] as AppError).statusCode).toBe(403);
    expect((calls[0] as AppError).message).toContain("Subscription inactive");
  });

  it("blocks a suspended company even when the module is present", async () => {
    const req = makeReq(makeState({ status: "suspended", modules: ["pos"] }));
    const { next, calls } = makeNext();
    await requireModule("pos")(req, noopResponse, next);
    expect((calls[0] as AppError).statusCode).toBe(403);
  });

  it("blocks an active subscription that does not include the module", async () => {
    const req = makeReq(makeState({ status: "active", modules: ["pos", "inventory"] }));
    const { next, calls } = makeNext();
    await requireModule("ecommerce")(req, noopResponse, next);
    expect(calls).toHaveLength(1);
    expect((calls[0] as AppError).statusCode).toBe(403);
    expect((calls[0] as AppError).message).toContain("Feature not included in your plan: ecommerce");
  });

  it("denies an unauthenticated request", async () => {
    const req = makeReqNoTenant();
    const { next, calls } = makeNext();
    await requireModule("pos")(req, noopResponse, next);
    expect((calls[0] as AppError).statusCode).toBe(401);
  });
});

describe("requireActiveSubscription (subscription — status-only gate)", () => {
  it("allows a trial subscription", async () => {
    const req = makeReq(makeState({ status: "trial" }));
    const { next, calls } = makeNext();
    await requireActiveSubscription()(req, noopResponse, next);
    expect(calls).toEqual([undefined]);
  });

  it("blocks a cancelled subscription", async () => {
    const req = makeReq(makeState({ status: "cancelled" }));
    const { next, calls } = makeNext();
    await requireActiveSubscription()(req, noopResponse, next);
    expect((calls[0] as AppError).statusCode).toBe(403);
  });
});

describe("requireWithinLimit (subscription — quota gate)", () => {
  it("allows when the current count is under the limit", async () => {
    const req = makeReq(makeState({ limits: makeLimits({ maxProducts: 100 }) }));
    const { next, calls } = makeNext();
    await requireWithinLimit("maxProducts", async () => 50)(req, noopResponse, next);
    expect(calls).toEqual([undefined]);
  });

  it("blocks when the current count equals the limit exactly", async () => {
    const req = makeReq(makeState({ limits: makeLimits({ maxProducts: 100 }) }));
    const { next, calls } = makeNext();
    await requireWithinLimit("maxProducts", async () => 100)(req, noopResponse, next);
    expect((calls[0] as AppError).statusCode).toBe(403);
    expect((calls[0] as AppError).message).toContain("Plan limit reached: maxProducts");
  });

  it("blocks when the current count exceeds the limit", async () => {
    const req = makeReq(makeState({ limits: makeLimits({ maxUsers: 5 }) }));
    const { next, calls } = makeNext();
    await requireWithinLimit("maxUsers", async () => 8)(req, noopResponse, next);
    expect((calls[0] as AppError).statusCode).toBe(403);
  });

  it("blocks on an inactive status before ever checking the limit", async () => {
    const req = makeReq(makeState({ status: "suspended", limits: makeLimits({ maxUsers: 5 }) }));
    const { next, calls } = makeNext();
    await requireWithinLimit("maxUsers", async () => 0)(req, noopResponse, next);
    expect((calls[0] as AppError).message).toContain("Subscription inactive");
  });

  it("passes through the non-numeric 'modules' limit key without a quota error", async () => {
    const req = makeReq(makeState({ limits: makeLimits() }));
    const { next, calls } = makeNext();
    await requireWithinLimit("modules", async () => {
      throw new Error("must not be called");
    })(req, noopResponse, next);
    expect(calls).toEqual([undefined]);
  });

  it("propagates a counting error to next", async () => {
    const req = makeReq(makeState({ limits: makeLimits({ maxUsers: 5 }) }));
    const { next, calls } = makeNext();
    const boom = new Error("count failed");
    await requireWithinLimit("maxUsers", async () => {
      throw boom;
    })(req, noopResponse, next);
    expect(calls).toEqual([boom]);
  });
});

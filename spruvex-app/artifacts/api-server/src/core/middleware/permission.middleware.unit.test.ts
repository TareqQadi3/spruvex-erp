import { describe, it, expect } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import type { TenantContext } from "../../shared/types/tenantContext";

// Importing permission.middleware pulls config/env (via the permission
// resolver's cache module), and env.ts requires PORT — set it (and a fixed
// JWT secret for determinism) before importing so this runs standalone.
process.env.JWT_SECRET ??= "unit-test-only-secret-not-for-real-use";
process.env.PORT ??= "5000";

const { requireRole, requirePermission } = await import("./permission.middleware");

// T-08: RBAC enforcement decisions. The permission RESOLVER is DB-backed (see
// permissionResolverService) and stays integration-covered; these tests pin
// the middleware decision logic that runs on every protected route — the
// requireRole role check (pure from req.tenant) and requirePermission's
// pass/deny decision against the per-request cached permission list (the
// exact runtime path used when a route chains checks in one request). Both
// are exercised with a fake req/next and never touch a database.

const adminTenant: TenantContext = { userId: "user-1", companyId: "company-1", branchId: "branch-1", role: "admin" };

function makeReq(overrides: { tenant?: TenantContext; permissions?: string[] }): Request {
  return { tenant: overrides.tenant, permissions: overrides.permissions } as unknown as Request;
}

function makeNext() {
  const calls: unknown[] = [];
  const next: NextFunction = (err?: unknown) => {
    calls.push(err);
  };
  return { next, calls };
}

const noopResponse = {} as Response;

describe("requireRole (rbac — flat role gate)", () => {
  it("lets a request through when the tenant's role is in the allowed list", async () => {
    const req = makeReq({ tenant: adminTenant });
    const { next, calls } = makeNext();
    await requireRole("admin", "owner")(req, noopResponse, next);
    expect(calls).toEqual([undefined]);
  });

  it("denies a tenant whose role is not in the allowed list", async () => {
    const req = makeReq({ tenant: { ...adminTenant, role: "cashier" } });
    const { next, calls } = makeNext();
    await requireRole("admin")(req, noopResponse, next);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBeInstanceOf(AppError);
    expect((calls[0] as AppError).statusCode).toBe(403);
  });

  it("denies an unauthenticated request as forbidden (403) — same branch as a wrong role", async () => {
    const req = makeReq({ tenant: undefined });
    const { next, calls } = makeNext();
    await requireRole("admin")(req, noopResponse, next);
    expect(calls).toHaveLength(1);
    expect((calls[0] as AppError).statusCode).toBe(403);
  });
});

describe("requirePermission (rbac — granular permission gate)", () => {
  it("lets a request through when the cached permission list includes the required code", async () => {
    const req = makeReq({ tenant: adminTenant, permissions: ["sales.create", "products.view"] });
    const { next, calls } = makeNext();
    await requirePermission("sales.create")(req, noopResponse, next);
    expect(calls).toEqual([undefined]);
  });

  it("denies when the cached permission list lacks the required code", async () => {
    const req = makeReq({ tenant: adminTenant, permissions: ["products.view"] });
    const { next, calls } = makeNext();
    await requirePermission("sales.create")(req, noopResponse, next);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBeInstanceOf(AppError);
    expect((calls[0] as AppError).statusCode).toBe(403);
    expect((calls[0] as AppError).message).toContain("Missing permission: sales.create");
  });

  it("denies an unauthenticated request even before any permission check", async () => {
    const req = makeReq({ tenant: undefined });
    const { next, calls } = makeNext();
    await requirePermission("sales.create")(req, noopResponse, next);
    expect(calls).toHaveLength(1);
    expect((calls[0] as AppError).statusCode).toBe(401);
  });

  it("lets multiple chained checks reuse the same cached list across calls", async () => {
    const req = makeReq({ tenant: adminTenant, permissions: ["sales.create", "products.view"] });
    const { next, calls } = makeNext();
    await requirePermission("sales.create")(req, noopResponse, next);
    await requirePermission("products.view")(req, noopResponse, next);
    expect(calls).toEqual([undefined, undefined]);
  });
});

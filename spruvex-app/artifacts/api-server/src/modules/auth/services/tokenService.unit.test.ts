import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";

// tokenService reads env.jwtSecret at import time (config/env.ts), and env.ts
// requires PORT to be set or it throws — set both before importing so this
// test file works standalone (unit tests must not depend on a real .env).
process.env.JWT_SECRET ??= "unit-test-only-secret-not-for-real-use";
process.env.PORT ??= "5000";

const { signAccessToken, signRefreshToken, verifyRefreshToken } = await import("./tokenService");

describe("tokenService (auth — the identity contract every request trusts)", () => {
  const tenant = { userId: "user-1", companyId: "company-1", branchId: "branch-1", role: "admin" };

  it("signAccessToken embeds identity claims only, no permissions", () => {
    const token = signAccessToken(tenant);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as Record<string, unknown>;
    expect(decoded.sub).toBe(tenant.userId);
    expect(decoded.companyId).toBe(tenant.companyId);
    expect(decoded.branchId).toBe(tenant.branchId);
    expect(decoded.role).toBe(tenant.role);
    expect(decoded).not.toHaveProperty("permissions");
  });

  it("signAccessToken omits branchId when the tenant has none, rather than embedding null", () => {
    const token = signAccessToken({ userId: "user-1", companyId: "company-1", role: "cashier" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as Record<string, unknown>;
    expect(decoded.branchId).toBeUndefined();
  });

  it("signRefreshToken round-trips through verifyRefreshToken", () => {
    const token = signRefreshToken("user-1", "company-1");
    const result = verifyRefreshToken(token);
    expect(result).toEqual({ userId: "user-1", companyId: "company-1" });
  });

  it("verifyRefreshToken rejects an access token presented as a refresh token", () => {
    const accessToken = signAccessToken(tenant);
    expect(() => verifyRefreshToken(accessToken)).toThrow(/Not a refresh token/);
  });

  it("verifyRefreshToken rejects a token signed with a different secret", () => {
    const forged = jwt.sign({ sub: "user-1", companyId: "company-1", type: "refresh" }, "wrong-secret");
    expect(() => verifyRefreshToken(forged)).toThrow();
  });

  it("verifyRefreshToken rejects a garbage string", () => {
    expect(() => verifyRefreshToken("not.a.jwt")).toThrow();
  });
});

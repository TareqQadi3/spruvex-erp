import jwt from "jsonwebtoken";
import { env } from "../../../config/env";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from "../../../config/constants";
import type { TenantContext } from "../../../shared/types/tenantContext";

export interface AccessTokenPayload {
  sub: string;
  companyId: string;
  branchId?: string;
  role: string;
}

interface RefreshTokenPayload {
  sub: string;
  companyId: string;
  type: "refresh";
}

// Identity claims only — no permissions embedded. Authorization is resolved
// live from the DB per request by the RBAC PermissionResolver (see
// core/middleware/permission.middleware.ts), never trusted from the token.
export function signAccessToken(tenant: TenantContext): string {
  const payload: AccessTokenPayload = {
    sub: tenant.userId,
    companyId: tenant.companyId,
    branchId: tenant.branchId,
    role: tenant.role,
  };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
}

// Stateless by design for this pass: no server-side refresh-token store exists
// yet, so a refresh token can't be individually revoked before it expires —
// only verified by signature + expiry. Add a persistent store (and check it
// here) if revoke-on-demand becomes a requirement.
export function signRefreshToken(userId: string, companyId: string): string {
  const payload: RefreshTokenPayload = { sub: userId, companyId, type: "refresh" };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: REFRESH_TOKEN_TTL_SECONDS });
}

export function verifyRefreshToken(token: string): { userId: string; companyId: string } {
  const decoded = jwt.verify(token, env.jwtSecret) as RefreshTokenPayload;
  if (decoded.type !== "refresh") {
    throw new Error("Not a refresh token");
  }
  return { userId: decoded.sub, companyId: decoded.companyId };
}

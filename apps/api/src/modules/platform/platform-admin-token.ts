/**
 * Platform admin JWT claims — entirely separate from the tenant AccessTokenPayload
 * (token.service.ts). `type: "platform_admin"` is the discriminator both
 * AuthContextMiddleware (which ignores it, leaving no tenant context) and
 * PlatformAdminGuard (which requires it) rely on, so a stolen tenant token
 * can never pass as a platform admin token and vice versa.
 */
export interface PlatformAdminTokenPayload {
  sub: string;
  email: string;
  type: "platform_admin";
}

/** Short-lived — platform admins re-authenticate often, no refresh rotation yet (see docs/ARCHITECTURE.md). */
export const PLATFORM_ADMIN_TOKEN_TTL_SECONDS = 8 * 60 * 60;

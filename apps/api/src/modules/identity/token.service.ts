import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { PlatformPrismaService } from "../../shared/prisma/platform-prisma.service";

/** Access-token claims. tenant_id/permissions are absent until onboarding creates a tenant. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  tenant_id?: string;
  permissions?: string[];
  type: "access";
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface UserAuthContext {
  tenantId?: string;
  permissions: string[];
  onboardingCompleted: boolean;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly db: PlatformPrismaService,
  ) {}

  private get accessTtlSeconds(): number {
    return Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900);
  }

  private get refreshTtlMs(): number {
    return Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30) * 24 * 60 * 60 * 1000;
  }

  /**
   * Resolves the tenant + effective permission keys for a user. Runs on the
   * platform connection because it happens BEFORE a tenant context exists
   * (login/refresh). MVP: a user belongs to at most one tenant.
   */
  async resolveAuthContext(userId: string): Promise<UserAuthContext> {
    const memberships = await this.db.userRole.findMany({
      where: { userId, role: { deletedAt: null } },
      include: {
        role: { include: { rolePermissions: { include: { permission: true } } } },
        tenant: { select: { onboardingCompletedAt: true, status: true } },
      },
    });
    if (memberships.length === 0) {
      return { permissions: [], onboardingCompleted: false };
    }

    const tenantId = memberships[0].tenantId;
    const inTenant = memberships.filter((m) => m.tenantId === tenantId);
    const permissions = [
      ...new Set(
        inTenant.flatMap((m) => m.role.rolePermissions.map((rp) => rp.permission.key)),
      ),
    ];
    return {
      tenantId,
      permissions,
      onboardingCompleted: Boolean(inTenant[0].tenant.onboardingCompletedAt),
    };
  }

  /** Issues an access token + a NEW refresh-token family. */
  async issueTokenPair(
    user: { id: string; email: string },
    meta?: { ip?: string; userAgent?: string },
  ): Promise<TokenPair> {
    return this.buildPair(user, randomUUID(), meta);
  }

  /**
   * Rotates a refresh token: the presented token is revoked and replaced
   * within its family. Presenting an already-revoked token is treated as
   * theft — the entire family is revoked (reuse detection).
   */
  async rotateRefreshToken(
    presentedToken: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<TokenPair> {
    const record = await this.db.refreshToken.findUnique({
      where: { tokenHash: hashToken(presentedToken) },
      include: { user: { select: { id: true, email: true, isActive: true } } },
    });
    if (!record) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    if (record.revokedAt) {
      await this.revokeFamily(record.familyId);
      throw new UnauthorizedException("Refresh token reuse detected — session revoked");
    }
    if (record.expiresAt < new Date() || !record.user.isActive) {
      throw new UnauthorizedException("Session expired — sign in again");
    }

    await this.db.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return this.buildPair(record.user, record.familyId, meta);
  }

  /** Logout: revokes the whole family of the presented refresh token. */
  async revokeByToken(presentedToken: string): Promise<void> {
    const record = await this.db.refreshToken.findUnique({
      where: { tokenHash: hashToken(presentedToken) },
    });
    if (record) {
      await this.revokeFamily(record.familyId);
    }
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async buildPair(
    user: { id: string; email: string },
    familyId: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<TokenPair> {
    const auth = await this.resolveAuthContext(user.id);

    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      type: "access",
      ...(auth.tenantId
        ? { tenant_id: auth.tenantId, permissions: auth.permissions }
        : {}),
    };
    const accessToken = this.jwt.sign(payload, { expiresIn: this.accessTtlSeconds });

    const refreshToken = randomBytes(48).toString("base64url");
    await this.db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        familyId,
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      },
    });

    return { accessToken, refreshToken, expiresInSeconds: this.accessTtlSeconds };
  }
}

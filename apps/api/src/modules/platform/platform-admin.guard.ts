import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { PlatformAdmin } from "@prisma/client";
import type { Request } from "express";

import { PlatformPrismaService } from "../../shared/prisma/platform-prisma.service";
import type { PlatformAdminTokenPayload } from "./platform-admin-token";

export interface PlatformRequest extends Request {
  platformAdmin: PlatformAdmin;
}

/**
 * Authenticates platform-admin requests. Entirely separate from the tenant
 * RBAC (@RequirePermission/PermissionsGuard): platform controllers are
 * marked @Public() (so PermissionsGuard doesn't reject them for lacking a
 * permission decorator) and rely solely on this guard instead. A tenant
 * user's access token is rejected here because it has no `type:
 * "platform_admin"` claim, and a platform admin token is rejected by every
 * tenant-scoped endpoint because AuthContextMiddleware only populates tenant
 * context for `type: "access"` tokens.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly platformDb: PlatformPrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<PlatformRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing platform admin token");
    }

    let payload: PlatformAdminTokenPayload;
    try {
      payload = this.jwt.verify<PlatformAdminTokenPayload>(header.slice("Bearer ".length));
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
    if (payload.type !== "platform_admin") {
      throw new UnauthorizedException("Not a platform admin token");
    }

    const admin = await this.platformDb.platformAdmin.findUnique({ where: { id: payload.sub } });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException("Platform admin account inactive");
    }

    req.platformAdmin = admin;
    return true;
  }
}

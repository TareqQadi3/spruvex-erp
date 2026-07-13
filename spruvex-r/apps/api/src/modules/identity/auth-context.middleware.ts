import { Injectable, NestMiddleware } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { NextFunction, Request, Response } from "express";

import { TenantContextService } from "../../shared/tenancy/tenant-context.service";
import type { AccessTokenPayload } from "./token.service";

/**
 * Verifies the Bearer access token and wraps the rest of the request in the
 * AsyncLocalStorage tenant context. tenant_id and permissions come from the
 * signed token ONLY — never from client parameters (plan §12).
 *
 * An absent/invalid token just leaves the request unauthenticated; the global
 * PermissionsGuard rejects it unless the endpoint is @Public.
 */
@Injectable()
export class AuthContextMiddleware implements NestMiddleware {
  constructor(
    private readonly jwt: JwtService,
    private readonly tenantContext: TenantContextService,
  ) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return next();
    }

    let payload: AccessTokenPayload;
    try {
      payload = this.jwt.verify<AccessTokenPayload>(header.slice("Bearer ".length));
    } catch {
      return next();
    }
    if (payload.type !== "access" || !payload.sub) {
      return next();
    }

    this.tenantContext.run(
      {
        userId: payload.sub,
        tenantId: payload.tenant_id,
        permissions: new Set(payload.permissions ?? []),
      },
      next,
    );
  }
}

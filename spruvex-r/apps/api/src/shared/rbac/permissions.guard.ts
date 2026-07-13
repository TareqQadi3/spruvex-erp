import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { PermissionKey } from "@spruvex-r/types";

import { TenantContextService } from "../tenancy/tenant-context.service";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { REQUIRE_AUTH_KEY } from "./require-authenticated.decorator";
import { PERMISSIONS_KEY } from "./require-permission.decorator";

/**
 * Global guard enforcing the "no implicit trust" rule:
 * - @Public() endpoints pass through.
 * - @RequireAuthenticated() endpoints need a valid authenticated context
 *   (pre-tenant onboarding only).
 * - Endpoints without an explicit declaration are DENIED.
 * - Otherwise the authenticated context must hold every required permission.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    if (this.reflector.getAllAndOverride<boolean>(REQUIRE_AUTH_KEY, targets)) {
      // Throws UnauthorizedException when the request is unauthenticated.
      return Boolean(this.tenantContext.contextOrThrow);
    }

    const required = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(
      PERMISSIONS_KEY,
      targets,
    );
    if (!required || required.length === 0) {
      throw new ForbiddenException(
        "Endpoint has no @RequirePermission() declaration — denied by default",
      );
    }

    // Throws UnauthorizedException when the request carries no authenticated context.
    const { permissions } = this.tenantContext.contextOrThrow;

    const missing = required.filter((permission) => !permissions.has(permission));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission(s): ${missing.join(", ")}`);
    }
    return true;
  }
}

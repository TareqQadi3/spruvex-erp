import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { IS_PUBLIC_KEY } from "../rbac/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenancy/tenant-context.service";
import { BILLING_EXEMPT_KEY } from "./billing-exempt.decorator";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Billing gate (Phase 8): blocks WRITE requests once a tenant's account is
 * suspended or its subscription is cancelled/suspended/trial-expired. Reads
 * stay open so an owner can still see their data and go fix billing.
 *
 * Deliberately separate from PermissionsGuard (RBAC) — this is a SaaS
 * account-standing check, not a permission check, and applies regardless
 * of which permission the endpoint requires.
 */
@Injectable()
export class TenantAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }
    if (this.reflector.getAllAndOverride<boolean>(BILLING_EXEMPT_KEY, targets)) {
      return true;
    }

    const ctx = this.tenantContext.context;
    if (!ctx?.tenantId) {
      return true; // pre-onboarding / platform-admin requests — nothing to gate
    }

    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) {
      return true;
    }

    const [tenant, subscription] = await Promise.all([
      this.prisma.scoped.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: { status: true },
      }),
      this.prisma.scoped.subscription.findUnique({
        where: { tenantId: ctx.tenantId },
        select: { status: true, trialEndsAt: true },
      }),
    ]);

    if (tenant?.status === "suspended") {
      throw new HttpException(
        "This restaurant's account has been suspended. Contact SpruVex support.",
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    if (subscription) {
      const trialExpired =
        subscription.status === "trialing" &&
        subscription.trialEndsAt !== null &&
        subscription.trialEndsAt.getTime() < Date.now();
      if (subscription.status === "suspended" || subscription.status === "cancelled" || trialExpired) {
        throw new HttpException(
          "Subscription inactive — upgrade your plan to continue.",
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    return true;
  }
}

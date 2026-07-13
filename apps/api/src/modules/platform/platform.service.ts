import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { AuditService } from "../../shared/audit/audit.service";
import { PlatformPrismaService } from "../../shared/prisma/platform-prisma.service";
import { GUEST_ACTOR, TenantContextService } from "../../shared/tenancy/tenant-context.service";

/**
 * Cross-tenant oversight for the SpruVex ops team: tenants, subscriptions,
 * system status. Runs entirely on PlatformPrismaService (BYPASSRLS) — this
 * IS the intended use of that connection (see its class doc comment).
 * Audit entries are written under a synthetic system actor in the affected
 * tenant's own audit trail (same pattern as Phase 7's stock-deduction
 * listener), with the acting platform admin's email recorded in `meta` for
 * traceability since platform admins aren't rows in the tenant's `users` table.
 */
@Injectable()
export class PlatformService {
  constructor(
    private readonly db: PlatformPrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async listTenants(query: { search?: string; status?: "active" | "suspended" } = {}) {
    const tenants = await this.db.tenant.findMany({
      where: {
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { slug: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        subscription: { include: { plan: { select: { key: true, name: true, nameEn: true } } } },
        _count: { select: { branches: true } },
      },
    });
    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      nameEn: t.nameEn,
      slug: t.slug,
      status: t.status,
      country: t.country,
      createdAt: t.createdAt,
      onboardingCompletedAt: t.onboardingCompletedAt,
      branchCount: t._count.branches,
      subscription: t.subscription
        ? { status: t.subscription.status, trialEndsAt: t.subscription.trialEndsAt, plan: t.subscription.plan }
        : null,
    }));
  }

  async getTenant(id: string) {
    const tenant = await this.db.tenant.findUnique({
      where: { id },
      include: {
        subscription: { include: { plan: true } },
        branches: {
          where: { deletedAt: null },
          select: { id: true, name: true, nameEn: true, isActive: true },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }
    const members = await this.db.userRole.findMany({
      where: { tenantId: id },
      select: { userId: true },
      distinct: ["userId"],
    });
    return { ...tenant, userCount: members.length };
  }

  async setTenantStatus(id: string, status: "active" | "suspended", platformAdminEmail: string) {
    const tenant = await this.db.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }
    const updated = await this.db.tenant.update({ where: { id }, data: { status } });
    await this.auditAsSystem(id, {
      action: status === "suspended" ? "tenant.suspended_by_platform" : "tenant.reactivated_by_platform",
      entityType: "tenant",
      entityId: id,
      meta: { platformAdminEmail },
    });
    return updated;
  }

  async listSubscriptions() {
    return this.db.subscription.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        tenant: { select: { id: true, name: true, nameEn: true, slug: true, status: true } },
        plan: { select: { key: true, name: true, nameEn: true } },
      },
    });
  }

  async updateSubscriptionStatus(
    id: string,
    status: "trialing" | "active" | "past_due" | "suspended" | "cancelled",
    platformAdminEmail: string,
  ) {
    const subscription = await this.db.subscription.findUnique({ where: { id } });
    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }
    const updated = await this.db.subscription.update({
      where: { id },
      data: {
        status,
        cancelledAt: status === "cancelled" ? new Date() : null,
        ...(status === "active"
          ? { currentPeriodStart: new Date(), currentPeriodEnd: addDays(new Date(), 30) }
          : {}),
      },
    });
    await this.auditAsSystem(subscription.tenantId, {
      action: "subscription.status_changed_by_platform",
      entityType: "subscription",
      entityId: id,
      meta: { status, platformAdminEmail },
    });
    return updated;
  }

  async changeTenantPlan(subscriptionId: string, planKey: string, platformAdminEmail: string) {
    const subscription = await this.db.subscription.findUnique({ where: { id: subscriptionId } });
    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }
    const plan = await this.db.plan.findUnique({ where: { key: planKey } });
    if (!plan) {
      throw new NotFoundException("Unknown plan");
    }
    const updated = await this.db.subscription.update({
      where: { id: subscriptionId },
      data: { planId: plan.id },
    });
    await this.auditAsSystem(subscription.tenantId, {
      action: "subscription.plan_changed_by_platform",
      entityType: "subscription",
      entityId: subscriptionId,
      meta: { planKey, platformAdminEmail },
    });
    return updated;
  }

  async systemStatus() {
    const [tenantCount, activeTenants, suspendedTenants, subscriptionsByStatus, dbOk] = await Promise.all([
      this.db.tenant.count({ where: { deletedAt: null } }),
      this.db.tenant.count({ where: { deletedAt: null, status: "active" } }),
      this.db.tenant.count({ where: { deletedAt: null, status: "suspended" } }),
      this.db.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
      this.db.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    ]);
    return {
      database: dbOk ? "ok" : "down",
      tenants: { total: tenantCount, active: activeTenants, suspended: suspendedTenants },
      subscriptions: Object.fromEntries(subscriptionsByStatus.map((s) => [s.status, s._count._all])),
    };
  }

  /** Writes an audit entry into a specific tenant's trail from outside any request context. */
  private async auditAsSystem(
    tenantId: string,
    entry: { action: string; entityType: string; entityId: string; meta: Prisma.InputJsonValue },
  ): Promise<void> {
    await this.tenantContext.run(
      { userId: GUEST_ACTOR, tenantId, permissions: new Set() },
      () => this.audit.log({ ...entry, tenantId }),
    );
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

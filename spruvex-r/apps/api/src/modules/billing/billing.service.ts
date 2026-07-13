import { Injectable, NotFoundException } from "@nestjs/common";

import { AuditService } from "../../shared/audit/audit.service";
import { halalasToSar } from "../../shared/common/money";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { TenantContextService } from "../../shared/tenancy/tenant-context.service";

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  /** Global plan catalog — not tenant-scoped, so the base (non-RLS) client is correct here. */
  listPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async getSubscription() {
    const tenantId = this.tenantContext.tenantIdOrThrow;
    const subscription = await this.prisma.scoped.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    if (!subscription) {
      throw new NotFoundException("No subscription found for this tenant");
    }

    const [branchCount, members, ordersThisMonth] = await Promise.all([
      this.prisma.scoped.branch.count({ where: { deletedAt: null } }),
      this.prisma.scoped.userRole.findMany({ select: { userId: true }, distinct: ["userId"] }),
      this.prisma.scoped.order.count({ where: { createdAt: { gte: monthStart() } } }),
    ]);

    const trialDaysRemaining =
      subscription.status === "trialing" && subscription.trialEndsAt
        ? Math.max(0, Math.ceil((subscription.trialEndsAt.getTime() - Date.now()) / 86_400_000))
        : null;

    return {
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      trialDaysRemaining,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      plan: {
        key: subscription.plan.key,
        name: subscription.plan.name,
        nameEn: subscription.plan.nameEn,
        maxBranches: subscription.plan.maxBranches,
        maxUsers: subscription.plan.maxUsers,
        maxOrdersPerMonth: subscription.plan.maxOrdersPerMonth,
        priceMonthly: halalasToSar(subscription.plan.priceMonthlyHalalas),
        features: subscription.plan.features,
      },
      usage: {
        branches: branchCount,
        users: members.length,
        ordersThisMonth,
      },
    };
  }

  async changePlan(planKey: string) {
    const ctx = this.tenantContext.contextOrThrow;
    const tenantId = this.tenantContext.tenantIdOrThrow;

    const plan = await this.prisma.plan.findFirst({ where: { key: planKey, isActive: true } });
    if (!plan) {
      throw new NotFoundException("Unknown plan");
    }

    const subscription = await this.prisma.scoped.subscription.update({
      where: { tenantId },
      data: { planId: plan.id, updatedBy: ctx.userId },
      include: { plan: true },
    });

    await this.audit.log({
      action: "subscription.plan_changed",
      entityType: "subscription",
      entityId: subscription.id,
      meta: { planKey },
    });
    return subscription;
  }
}

function monthStart(): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

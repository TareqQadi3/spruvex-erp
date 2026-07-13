import { ForbiddenException, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

/**
 * Plan feature-limit enforcement (Phase 8 foundation): branches, users,
 * orders/month. A tenant with no subscription row (shouldn't happen once
 * every tenant gets one at provisioning) is treated as unlimited rather
 * than blocked, so a missing row never locks an existing customer out.
 */
@Injectable()
export class LimitsService {
  constructor(private readonly prisma: PrismaService) {}

  private async planFor(tenantId: string) {
    const subscription = await this.prisma.forTenant(tenantId).subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    return subscription?.plan ?? null;
  }

  async assertCanAddBranch(tenantId: string): Promise<void> {
    const plan = await this.planFor(tenantId);
    if (!plan) return;
    const count = await this.prisma.forTenant(tenantId).branch.count({ where: { deletedAt: null } });
    if (count >= plan.maxBranches) {
      throw new ForbiddenException(
        `Your plan (${plan.name}) allows up to ${plan.maxBranches} branch(es). Upgrade to add more.`,
      );
    }
  }

  async assertCanAddUsers(tenantId: string, additionalCount: number): Promise<void> {
    const plan = await this.planFor(tenantId);
    if (!plan) return;
    const members = await this.prisma.forTenant(tenantId).userRole.findMany({
      select: { userId: true },
      distinct: ["userId"],
    });
    if (members.length + additionalCount > plan.maxUsers) {
      throw new ForbiddenException(
        `Your plan (${plan.name}) allows up to ${plan.maxUsers} user(s). Upgrade to add more.`,
      );
    }
  }

  async assertCanCreateOrder(tenantId: string): Promise<void> {
    const plan = await this.planFor(tenantId);
    if (!plan || plan.maxOrdersPerMonth === null) return;

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const count = await this.prisma.forTenant(tenantId).order.count({
      where: { createdAt: { gte: monthStart } },
    });
    if (count >= plan.maxOrdersPerMonth) {
      throw new ForbiddenException(
        `Monthly order limit reached for your plan (${plan.name}). Upgrade to continue taking orders.`,
      );
    }
  }
}

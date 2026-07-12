import { Controller, Get } from "@nestjs/common";

import { RequireAuthenticated } from "../../shared/rbac/require-authenticated.decorator";
import { RequirePermission } from "../../shared/rbac/require-permission.decorator";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { TenantContextService } from "../../shared/tenancy/tenant-context.service";

/** Read endpoints backing the dashboard shell (branches / team / roles / restaurant info). */
@Controller()
export class TenancyController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @RequirePermission("tenant.settings.manage")
  @Get("tenant")
  tenant() {
    return this.prisma.scoped.tenant.findUnique({
      where: { id: this.tenantContext.tenantIdOrThrow },
      select: {
        id: true,
        name: true,
        nameEn: true,
        slug: true,
        logoUrl: true,
        type: true,
        country: true,
        currency: true,
        defaultLocale: true,
        vatNumber: true,
        crNumber: true,
        vatRate: true,
        onboardingCompletedAt: true,
      },
    });
  }

  @RequirePermission("branches.manage")
  @Get("branches")
  branches() {
    return this.prisma.scoped.branch.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        nameEn: true,
        slug: true,
        address: true,
        phone: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  /**
   * Branches the signed-in member can work in (KDS/POS branch picker).
   * Membership with branchId=null means tenant-wide access.
   */
  @RequireAuthenticated()
  @Get("my-branches")
  async myBranches() {
    const ctx = this.tenantContext.contextOrThrow;
    const memberships = await this.prisma.scoped.userRole.findMany({
      where: { userId: ctx.userId },
      select: { branchId: true },
    });
    const tenantWide = memberships.some((m) => m.branchId === null);
    const branchIds = memberships.map((m) => m.branchId).filter((id): id is string => !!id);

    return this.prisma.scoped.branch.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(tenantWide ? {} : { id: { in: branchIds } }),
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, nameEn: true, slug: true },
    });
  }

  @RequirePermission("users.manage")
  @Get("users")
  async users() {
    const memberships = await this.prisma.scoped.userRole.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true, lastLoginAt: true } },
        role: { select: { key: true, nameAr: true, nameEn: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      isActive: m.user.isActive,
      lastLoginAt: m.user.lastLoginAt,
      role: m.role,
      branch: m.branch,
    }));
  }

  @RequirePermission("users.manage")
  @Get("roles")
  roles() {
    return this.prisma.scoped.role.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        key: true,
        nameAr: true,
        nameEn: true,
        isSystem: true,
        rolePermissions: { select: { permission: { select: { key: true } } } },
      },
    });
  }
}

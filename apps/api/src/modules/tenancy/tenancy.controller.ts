import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
} from "@nestjs/common";

import { AuditService } from "../../shared/audit/audit.service";
import { RequireAuthenticated } from "../../shared/rbac/require-authenticated.decorator";
import { RequirePermission } from "../../shared/rbac/require-permission.decorator";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { TenantContextService } from "../../shared/tenancy/tenant-context.service";
import { UpdateOrderingSettingsDto } from "./dto/branch-ordering-settings.dto";
import { UpdateTenantDto } from "./dto/tenant-settings.dto";

/** Read endpoints backing the dashboard shell (branches / team / roles / restaurant info). */
@Controller()
export class TenancyController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  @RequirePermission("tenant.settings.manage")
  @Get("tenant")
  async tenant() {
    const tenant = await this.prisma.scoped.tenant.findUnique({
      where: { id: this.tenantContext.tenantIdOrThrow },
      select: {
        id: true,
        name: true,
        nameEn: true,
        slug: true,
        logoUrl: true,
        legalName: true,
        type: true,
        country: true,
        currency: true,
        defaultLocale: true,
        vatNumber: true,
        crNumber: true,
        address: true,
        vatRate: true,
        onboardingCompletedAt: true,
      },
    });
    return {
      ...tenant,
      /** Base URL of the customer ordering app (public menu links). */
      publicBaseUrl: (process.env.ORDERING_BASE_URL ?? "").replace(/\/+$/, ""),
    };
  }

  /** Establishment / ZATCA data (legal name, VAT number, CR, address). */
  @RequirePermission("tenant.settings.manage")
  @Patch("tenant")
  async updateTenant(@Body() dto: UpdateTenantDto) {
    const ctx = this.tenantContext.contextOrThrow;
    const tenant = await this.prisma.scoped.tenant.update({
      where: { id: this.tenantContext.tenantIdOrThrow },
      data: { ...dto, updatedBy: ctx.userId },
      select: {
        id: true,
        name: true,
        nameEn: true,
        legalName: true,
        vatNumber: true,
        crNumber: true,
        address: true,
      },
    });
    await this.audit.log({
      action: "tenant.settings_updated",
      entityType: "tenant",
      entityId: tenant.id,
      meta: { changes: { ...dto } },
    });
    return tenant;
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
        orderingSettings: true,
        createdAt: true,
      },
    });
  }

  /**
   * Self-ordering settings for one branch: enable/disable QR table
   * ordering, require-cashier-confirmation. Also returns the public menu
   * link so the dashboard can show/copy it.
   */
  @RequirePermission("branches.manage")
  @Patch("branches/:id/ordering-settings")
  async updateOrderingSettings(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderingSettingsDto,
  ) {
    const ctx = this.tenantContext.contextOrThrow;
    const existing = await this.prisma.scoped.branch.findFirst({
      where: { id, deletedAt: null },
      select: { orderingSettings: true },
    });
    if (!existing) {
      throw new NotFoundException("Branch not found");
    }
    const current = (existing.orderingSettings ?? {}) as Record<string, unknown>;

    const branch = await this.prisma.scoped.branch.update({
      where: { id },
      data: {
        orderingSettings: { ...current, ...dto },
        updatedBy: ctx.userId,
      },
      select: { id: true, slug: true, orderingSettings: true },
    });
    await this.audit.log({
      action: "branch.ordering_settings_updated",
      entityType: "branch",
      entityId: id,
      branchId: id,
      meta: { changes: { ...dto } },
    });
    return branch;
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

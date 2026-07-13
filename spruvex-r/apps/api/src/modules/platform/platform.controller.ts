import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from "@nestjs/common";

import { Public } from "../../shared/rbac/public.decorator";
import { CurrentPlatformAdmin } from "./current-platform-admin.decorator";
import {
  ChangeTenantPlanDto,
  UpdateSubscriptionDto,
  UpdateTenantStatusDto,
} from "./dto/platform-admin.dto";
import { PlatformAdminGuard } from "./platform-admin.guard";
import { PlatformService } from "./platform.service";

/**
 * Cross-tenant SpruVex ops console. @Public() so the tenant RBAC guard
 * (PermissionsGuard) doesn't reject these routes for lacking a
 * @RequirePermission() — authorization here is entirely PlatformAdminGuard,
 * a completely separate plane from tenant permissions by design.
 */
@Public()
@UseGuards(PlatformAdminGuard)
@Controller("platform")
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get("tenants")
  listTenants(@Query("search") search?: string, @Query("status") status?: "active" | "suspended") {
    return this.platform.listTenants({ search, status });
  }

  @Get("tenants/:id")
  getTenant(@Param("id", ParseUUIDPipe) id: string) {
    return this.platform.getTenant(id);
  }

  @Patch("tenants/:id/status")
  setTenantStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantStatusDto,
    @CurrentPlatformAdmin() admin: { email: string },
  ) {
    return this.platform.setTenantStatus(id, dto.status, admin.email);
  }

  @Get("subscriptions")
  listSubscriptions() {
    return this.platform.listSubscriptions();
  }

  @Patch("subscriptions/:id/status")
  updateSubscriptionStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentPlatformAdmin() admin: { email: string },
  ) {
    return this.platform.updateSubscriptionStatus(id, dto.status, admin.email);
  }

  @Patch("subscriptions/:id/plan")
  changeTenantPlan(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ChangeTenantPlanDto,
    @CurrentPlatformAdmin() admin: { email: string },
  ) {
    return this.platform.changeTenantPlan(id, dto.planKey, admin.email);
  }

  @Get("system-status")
  systemStatus() {
    return this.platform.systemStatus();
  }
}

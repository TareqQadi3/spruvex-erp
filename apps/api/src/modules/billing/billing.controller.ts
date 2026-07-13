import { Body, Controller, Get, Post } from "@nestjs/common";

import { RequirePermission } from "../../shared/rbac/require-permission.decorator";
import { BillingExempt } from "../../shared/billing/billing-exempt.decorator";
import { BillingService } from "./billing.service";
import { ChangePlanDto } from "./dto/change-plan.dto";

/**
 * Subscription & plan endpoints. @BillingExempt on the whole controller —
 * a tenant blocked by TenantAccessGuard (suspended/cancelled/trial-expired)
 * must still be able to see its subscription and change plan.
 */
@BillingExempt()
@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @RequirePermission("billing.view")
  @Get("plans")
  plans() {
    return this.billing.listPlans();
  }

  @RequirePermission("billing.view")
  @Get("subscription")
  subscription() {
    return this.billing.getSubscription();
  }

  @RequirePermission("billing.manage")
  @Post("subscription/change-plan")
  changePlan(@Body() dto: ChangePlanDto) {
    return this.billing.changePlan(dto.planKey);
  }
}

import { Module } from "@nestjs/common";

import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";

/**
 * SaaS billing (Phase 8): plan catalog, subscription view/change. No
 * payment gateway is wired — see plan-catalog.ts and Subscription's
 * external*Id columns for the integration points a gateway would use.
 * Cross-cutting enforcement (TenantAccessGuard, LimitsService) lives in
 * shared/billing instead, so every module can use it without importing
 * this one.
 */
@Module({
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}

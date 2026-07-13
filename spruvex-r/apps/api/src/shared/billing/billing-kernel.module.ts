import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { LimitsService } from "./limits.service";
import { TenantAccessGuard } from "./tenant-access.guard";

/**
 * Shared-kernel billing pieces used across modules: the account-standing
 * gate (TenantAccessGuard) and plan-limit checks (LimitsService). The
 * user-facing plan/subscription CRUD lives in modules/billing instead.
 */
@Global()
@Module({
  providers: [
    LimitsService,
    { provide: APP_GUARD, useClass: TenantAccessGuard },
  ],
  exports: [LimitsService],
})
export class BillingKernelModule {}

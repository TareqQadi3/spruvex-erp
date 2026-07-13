import { SetMetadata } from "@nestjs/common";

export const BILLING_EXEMPT_KEY = "spruvex:billingExempt";

/**
 * Marks an endpoint that must stay reachable even when a tenant is
 * blocked (suspended tenant / cancelled or expired subscription) — the
 * subscription view and the "change plan" action, so a blocked tenant can
 * always see why and fix it. Everything else is write-blocked by
 * TenantAccessGuard while blocked.
 */
export const BillingExempt = () => SetMetadata(BILLING_EXEMPT_KEY, true);

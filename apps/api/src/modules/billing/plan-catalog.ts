import { PrismaClient } from "@prisma/client";

import { PLAN_CATALOG } from "@spruvex-r/types";

/**
 * Upserts the global plan catalog from @spruvex-r/types. Idempotent — same
 * pattern as syncPermissionCatalog/syncUnitCatalog. Runs on the admin
 * (BYPASSRLS) connection; plans has no tenant_id / RLS.
 */
export async function syncPlanCatalog(db: PrismaClient): Promise<void> {
  for (const plan of PLAN_CATALOG) {
    await db.plan.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        nameEn: plan.nameEn,
        maxBranches: plan.maxBranches,
        maxUsers: plan.maxUsers,
        maxOrdersPerMonth: plan.maxOrdersPerMonth,
        priceMonthlyHalalas: plan.priceMonthlyHalalas,
        priceYearlyHalalas: plan.priceYearlyHalalas,
        features: plan.features,
        sortOrder: plan.sortOrder,
      },
      create: {
        key: plan.key,
        name: plan.name,
        nameEn: plan.nameEn,
        maxBranches: plan.maxBranches,
        maxUsers: plan.maxUsers,
        maxOrdersPerMonth: plan.maxOrdersPerMonth,
        priceMonthlyHalalas: plan.priceMonthlyHalalas,
        priceYearlyHalalas: plan.priceYearlyHalalas,
        features: plan.features,
        sortOrder: plan.sortOrder,
      },
    });
  }
}

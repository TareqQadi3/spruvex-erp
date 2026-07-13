import { PrismaClient } from "@prisma/client";

import { UNIT_CATALOG } from "@spruvex-r/types";

/**
 * Upserts the global unit-of-measure catalog from @spruvex-r/types.
 * Idempotent — same pattern as syncPermissionCatalog. Runs on the admin
 * (BYPASSRLS) connection; units_of_measure has no tenant_id / RLS.
 */
export async function syncUnitCatalog(db: PrismaClient): Promise<void> {
  for (const unit of UNIT_CATALOG) {
    await db.unitOfMeasure.upsert({
      where: { code: unit.code },
      update: { name: unit.name, nameEn: unit.nameEn, type: unit.type, toBaseFactor: unit.toBaseFactor },
      create: {
        code: unit.code,
        name: unit.name,
        nameEn: unit.nameEn,
        type: unit.type,
        toBaseFactor: unit.toBaseFactor,
      },
    });
  }
}

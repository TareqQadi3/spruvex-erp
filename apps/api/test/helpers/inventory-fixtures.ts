import { PrismaClient } from "@prisma/client";

import { syncUnitCatalog } from "../../src/modules/inventory/unit-catalog";

/** Syncs the global unit catalog and returns the base units used by fixtures/tests. */
export async function setupUnits(admin: PrismaClient) {
  await syncUnitCatalog(admin);
  const [gram, kilogram, piece] = await Promise.all([
    admin.unitOfMeasure.findUniqueOrThrow({ where: { code: "g" } }),
    admin.unitOfMeasure.findUniqueOrThrow({ where: { code: "kg" } }),
    admin.unitOfMeasure.findUniqueOrThrow({ where: { code: "pc" } }),
  ]);
  return { gram, kilogram, piece };
}

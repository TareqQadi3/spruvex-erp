import { PrismaClient } from "@prisma/client";

import { hashPassword, hashPin } from "../src/modules/identity/password";
import {
  provisionTenant,
  syncPermissionCatalog,
} from "../src/modules/tenancy/tenant-provisioning";

/**
 * Development seed — permission catalog + one demo restaurant.
 * Runs on the admin (BYPASSRLS) connection. Idempotent.
 *
 * Demo credentials (development only):
 *   owner:   owner@demo.spruvex.local  / SpruVex-Demo1
 *   cashier: cashier@demo.spruvex.local / SpruVex-Demo1  (POS PIN: 1234)
 */
async function main() {
  const adminUrl = process.env.ADMIN_DATABASE_URL;
  if (!adminUrl) {
    throw new Error("ADMIN_DATABASE_URL is required to run the seed");
  }
  const db = new PrismaClient({ datasourceUrl: adminUrl });

  try {
    await syncPermissionCatalog(db);
    console.log("Permission catalog synced.");

    const existing = await db.tenant.findUnique({ where: { slug: "demo" } });
    if (existing) {
      console.log("Demo tenant already exists — skipping.");
      return;
    }

    const owner = await db.user.create({
      data: {
        email: "owner@demo.spruvex.local",
        name: "صاحب المطعم",
        passwordHash: await hashPassword("SpruVex-Demo1"),
        emailVerifiedAt: new Date(),
      },
    });

    const provisioned = await provisionTenant(db, {
      name: "مطعم التجربة",
      nameEn: "Demo Restaurant",
      slug: "demo",
      type: "restaurant",
      vatNumber: "300000000000003",
      branch: { name: "الفرع الرئيسي", nameEn: "Main Branch", slug: "main" },
      ownerUserId: owner.id,
    });

    await db.tenant.update({
      where: { id: provisioned.tenantId },
      data: { onboardingCompletedAt: new Date() },
    });

    // A cashier with a POS PIN so later phases are demoable out of the box.
    const cashier = await db.user.create({
      data: {
        email: "cashier@demo.spruvex.local",
        name: "كاشير التجربة",
        passwordHash: await hashPassword("SpruVex-Demo1"),
        emailVerifiedAt: new Date(),
      },
    });
    await db.userRole.create({
      data: {
        tenantId: provisioned.tenantId,
        userId: cashier.id,
        roleId: provisioned.roleIdsByKey.cashier,
        branchId: provisioned.branchId,
      },
    });
    await db.posPin.create({
      data: {
        tenantId: provisioned.tenantId,
        branchId: provisioned.branchId!,
        userId: cashier.id,
        pinHash: await hashPin("1234"),
      },
    });

    console.log(`Demo tenant created: ${provisioned.tenantId}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

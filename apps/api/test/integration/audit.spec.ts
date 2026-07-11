import { PrismaClient } from "@prisma/client";

import {
  provisionTenant,
  syncPermissionCatalog,
  type ProvisionedTenant,
} from "../../src/modules/tenancy/tenant-provisioning";
import { AuditService } from "../../src/shared/audit/audit.service";
import { PrismaService } from "../../src/shared/prisma/prisma.service";
import { TenantContextService } from "../../src/shared/tenancy/tenant-context.service";
import { createAdminClient, createRawAppClient, truncateAll } from "../helpers/db";

describe("audit log", () => {
  let admin: PrismaClient;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let audit: AuditService;
  let tenant: ProvisionedTenant;

  beforeAll(async () => {
    admin = createAdminClient();
    await truncateAll(admin);
    await syncPermissionCatalog(admin);
    tenant = await provisionTenant(admin, {
      name: "مطعم التدقيق",
      slug: "audit-tenant",
      owner: { name: "Owner", email: "owner@audit.test", password: "Test-12345" },
    });

    tenantContext = new TenantContextService();
    prisma = new PrismaService(tenantContext);
    audit = new AuditService(prisma, tenantContext);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await admin.$disconnect();
  });

  it("writes entries with the current tenant/user context", async () => {
    await tenantContext.run(
      {
        tenantId: tenant.tenantId,
        userId: tenant.ownerUserId,
        branchId: tenant.branchId,
        permissions: new Set(),
      },
      () =>
        audit.log({
          action: "role.permissions_changed",
          entityType: "role",
          entityId: tenant.roleIdsByKey.cashier,
          meta: { added: ["orders.discount"] },
        }),
    );

    const rows = await admin.auditLog.findMany({ where: { tenantId: tenant.tenantId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenantId: tenant.tenantId,
      userId: tenant.ownerUserId,
      branchId: tenant.branchId,
      action: "role.permissions_changed",
      entityType: "role",
    });
  });

  it("refuses to log without an authenticated context", async () => {
    await expect(audit.log({ action: "x" })).rejects.toThrow(/tenant context/i);
  });

  it("is append-only for the app role (UPDATE/DELETE revoked)", async () => {
    const raw = createRawAppClient();
    try {
      await expect(
        raw.$executeRawUnsafe(`UPDATE audit_logs SET action = 'tampered'`),
      ).rejects.toThrow(/permission denied/i);
      await expect(raw.$executeRawUnsafe(`DELETE FROM audit_logs`)).rejects.toThrow(
        /permission denied/i,
      );
    } finally {
      await raw.$disconnect();
    }
  });
});

import { PrismaClient } from "@prisma/client";

import { syncPermissionCatalog } from "../../src/modules/tenancy/tenant-provisioning";
import { PrismaService } from "../../src/shared/prisma/prisma.service";
import { TenantContextService } from "../../src/shared/tenancy/tenant-context.service";
import { createAdminClient, createRawAppClient, truncateAll } from "../helpers/db";
import { provisionTestTenant } from "../helpers/provision";

type ProvisionedTenant = Awaited<ReturnType<typeof provisionTestTenant>>;

/**
 * The Phase 0 gate: proves that Row-Level Security + the tenant-scoped Prisma
 * client make cross-tenant reads/writes impossible, and that queries without
 * a tenant context fail closed (return nothing / reject writes).
 */
describe("multi-tenant isolation (RLS)", () => {
  let admin: PrismaClient;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let tenantA: ProvisionedTenant;
  let tenantB: ProvisionedTenant;

  beforeAll(async () => {
    admin = createAdminClient();
    await truncateAll(admin);
    await syncPermissionCatalog(admin);

    tenantA = await provisionTestTenant(admin, {
      name: "مطعم ألف",
      slug: "tenant-a",
      ownerEmail: "owner-a@rls.test",
    });
    tenantB = await provisionTestTenant(admin, {
      name: "مطعم باء",
      slug: "tenant-b",
      ownerEmail: "owner-b@rls.test",
    });

    tenantContext = new TenantContextService();
    prisma = new PrismaService(tenantContext);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await admin.$disconnect();
  });

  it("scopes reads to the current tenant", async () => {
    const branches = await prisma.forTenant(tenantA.tenantId).branch.findMany();
    expect(branches).toHaveLength(1);
    expect(branches[0].id).toBe(tenantA.branchId);
    expect(branches.every((b) => b.tenantId === tenantA.tenantId)).toBe(true);
  });

  it("cannot read another tenant's rows, even by primary key", async () => {
    const scopedToA = prisma.forTenant(tenantA.tenantId);

    const branchB = await scopedToA.branch.findUnique({
      where: { id: tenantB.branchId! },
    });
    expect(branchB).toBeNull();

    const tenantRowB = await scopedToA.tenant.findUnique({
      where: { id: tenantB.tenantId },
    });
    expect(tenantRowB).toBeNull();

    const rolesVisible = await scopedToA.role.findMany();
    expect(rolesVisible.every((r) => r.tenantId === tenantA.tenantId)).toBe(true);
  });

  it("rejects inserting rows that claim another tenant's id", async () => {
    await expect(
      prisma.forTenant(tenantA.tenantId).branch.create({
        data: {
          tenantId: tenantB.tenantId,
          name: "فرع مزور",
          slug: "forged",
        },
      }),
    ).rejects.toThrow(/row-level security/i);
  });

  it("cannot update or delete another tenant's rows", async () => {
    const scopedToA = prisma.forTenant(tenantA.tenantId);

    const updated = await scopedToA.branch.updateMany({
      where: { id: tenantB.branchId! },
      data: { name: "hijacked" },
    });
    expect(updated.count).toBe(0);

    const deleted = await scopedToA.role.deleteMany({
      where: { tenantId: tenantB.tenantId },
    });
    expect(deleted.count).toBe(0);

    // Verify tenant B is untouched.
    const branchB = await admin.branch.findUniqueOrThrow({ where: { id: tenantB.branchId! } });
    expect(branchB.name).not.toBe("hijacked");
  });

  it("fails closed when no tenant context is set", async () => {
    const raw = createRawAppClient();
    try {
      // Reads return nothing.
      expect(await raw.tenant.findMany()).toHaveLength(0);
      expect(await raw.branch.findMany()).toHaveLength(0);
      expect(await raw.role.findMany()).toHaveLength(0);

      // Writes are rejected.
      await expect(
        raw.branch.create({
          data: { tenantId: tenantA.tenantId, name: "no-context", slug: "no-context" },
        }),
      ).rejects.toThrow(/row-level security/i);
    } finally {
      await raw.$disconnect();
    }
  });

  it("`scoped` uses the request context and throws without one", () => {
    expect(() => prisma.scoped).toThrow(/tenant context/i);

    tenantContext.run(
      { userId: tenantA.ownerUserId, tenantId: tenantA.tenantId, permissions: new Set() },
      () => {
        expect(() => prisma.scoped).not.toThrow();
      },
    );
  });

  it("rejects malformed tenant ids before touching the database", () => {
    expect(() => prisma.forTenant("not-a-uuid")).toThrow(/invalid tenant id/i);
  });

  it("provisions the five system roles with default permissions", async () => {
    const scopedToA = prisma.forTenant(tenantA.tenantId);
    const roles = await scopedToA.role.findMany({ include: { rolePermissions: true } });
    expect(roles.map((r) => r.key).sort()).toEqual(
      ["cashier", "kitchen", "manager", "owner", "waiter"],
    );
    const owner = roles.find((r) => r.key === "owner");
    expect(owner!.rolePermissions.length).toBeGreaterThan(20);
  });
});

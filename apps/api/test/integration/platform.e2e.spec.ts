import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../../src/app.module";
import { syncPermissionCatalog } from "../../src/modules/tenancy/tenant-provisioning";
import { createAdminClient, truncateAll } from "../helpers/db";
import { provisionTestTenant } from "../helpers/provision";

describe("platform admin (e2e)", () => {
  let app: INestApplication;
  let admin: PrismaClient;
  let http: ReturnType<INestApplication["getHttpServer"]>;

  const PLATFORM_EMAIL = "ops@spruvex.internal";
  const PLATFORM_PASSWORD = "Platform-1pass";

  let tenantId = "";
  let tenantOwnerToken = "";

  async function tenantLogin(email: string): Promise<string> {
    const res = await request(http)
      .post("/auth/login")
      .send({ email, password: "Test-12345" })
      .expect(200);
    return res.body.tokens.accessToken;
  }

  function platformLogin(password = PLATFORM_PASSWORD) {
    return request(http).post("/platform/auth/login").send({ email: PLATFORM_EMAIL, password });
  }

  beforeAll(async () => {
    admin = createAdminClient();
    await truncateAll(admin);
    await syncPermissionCatalog(admin);

    const { hashPassword } = await import("../../src/modules/identity/password");
    await admin.platformAdmin.create({
      data: {
        email: PLATFORM_EMAIL,
        name: "SpruVex Ops",
        passwordHash: await hashPassword(PLATFORM_PASSWORD),
      },
    });

    const tenant = await provisionTestTenant(admin, {
      name: "مطعم تجريبي",
      slug: "platform-target",
      ownerEmail: "owner@platform-target.test",
    });
    tenantId = tenant.tenantId;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    http = app.getHttpServer();

    tenantOwnerToken = await tenantLogin("owner@platform-target.test");
  });

  afterAll(async () => {
    await app.close();
    await admin.$disconnect();
  });

  describe("authentication", () => {
    it("rejects an unknown email / wrong password uniformly", async () => {
      await platformLogin("Wrong-pass1").expect(401);
      await request(http)
        .post("/platform/auth/login")
        .send({ email: "ghost@spruvex.internal", password: PLATFORM_PASSWORD })
        .expect(401);
    });

    it("logs in, issues a platform admin token, and /me reflects it", async () => {
      const res = await platformLogin().expect(200);
      expect(res.body.accessToken).toBeDefined();

      const me = await request(http)
        .get("/platform/auth/me")
        .set("Authorization", `Bearer ${res.body.accessToken}`)
        .expect(200);
      expect(me.body.email).toBe(PLATFORM_EMAIL);
    });

    it("locks the account after repeated failed attempts", async () => {
      for (let i = 0; i < 5; i++) {
        await platformLogin("Wrong-pass1").expect(401);
      }
      const res = await platformLogin(); // correct password, but now locked
      expect(res.status).toBe(403);
    });
  });

  describe("cross-plane token isolation", () => {
    it("a tenant access token is rejected by platform endpoints", async () => {
      await request(http)
        .get("/platform/tenants")
        .set("Authorization", `Bearer ${tenantOwnerToken}`)
        .expect(401);
    });

    it("a platform admin token is rejected by tenant-scoped endpoints", async () => {
      // Wait out the lockout from the previous describe block isn't needed —
      // this uses a fresh admin created just for this assertion.
      const { hashPassword } = await import("../../src/modules/identity/password");
      await admin.platformAdmin.create({
        data: {
          email: "cross-plane@spruvex.internal",
          name: "Cross-plane test",
          passwordHash: await hashPassword("Cross-1pass"),
        },
      });
      const login = await request(http)
        .post("/platform/auth/login")
        .send({ email: "cross-plane@spruvex.internal", password: "Cross-1pass" })
        .expect(200);

      await request(http)
        .get("/branches")
        .set("Authorization", `Bearer ${login.body.accessToken}`)
        .expect(401);
    });

    it("rejects missing/garbage tokens on platform endpoints", async () => {
      await request(http).get("/platform/tenants").expect(401);
      await request(http)
        .get("/platform/tenants")
        .set("Authorization", "Bearer garbage")
        .expect(401);
    });

    it("rejects a deactivated platform admin's token on the next request", async () => {
      const email = "soon-inactive@spruvex.internal";
      const { hashPassword } = await import("../../src/modules/identity/password");
      const created = await admin.platformAdmin.create({
        data: { email, name: "Temp", passwordHash: await hashPassword("Temp-1pass") },
      });
      const login = await request(http)
        .post("/platform/auth/login")
        .send({ email, password: "Temp-1pass" })
        .expect(200);

      await admin.platformAdmin.update({ where: { id: created.id }, data: { isActive: false } });
      await request(http)
        .get("/platform/tenants")
        .set("Authorization", `Bearer ${login.body.accessToken}`)
        .expect(401);
    });
  });

  describe("tenant oversight", () => {
    let platformToken = "";

    beforeAll(async () => {
      // A fresh admin (the shared one above is locked from the lockout test).
      const { hashPassword } = await import("../../src/modules/identity/password");
      await admin.platformAdmin.create({
        data: {
          email: "oversight@spruvex.internal",
          name: "Oversight",
          passwordHash: await hashPassword("Oversight-1pass"),
        },
      });
      const res = await request(http)
        .post("/platform/auth/login")
        .send({ email: "oversight@spruvex.internal", password: "Oversight-1pass" })
        .expect(200);
      platformToken = res.body.accessToken;
    });

    it("lists tenants with subscription + branch summary", async () => {
      const res = await request(http)
        .get("/platform/tenants")
        .set("Authorization", `Bearer ${platformToken}`)
        .expect(200);
      const target = res.body.find((t: { id: string }) => t.id === tenantId);
      expect(target).toBeDefined();
      expect(target.branchCount).toBe(1);
      expect(target.subscription.plan.key).toBe("basic");
    });

    it("filters tenants by search and status", async () => {
      const bySearch = await request(http)
        .get("/platform/tenants?search=platform-target")
        .set("Authorization", `Bearer ${platformToken}`)
        .expect(200);
      expect(bySearch.body.some((t: { id: string }) => t.id === tenantId)).toBe(true);

      const byStatus = await request(http)
        .get("/platform/tenants?status=suspended")
        .set("Authorization", `Bearer ${platformToken}`)
        .expect(200);
      expect(byStatus.body.some((t: { id: string }) => t.id === tenantId)).toBe(false);
    });

    it("returns tenant detail with user count and branches", async () => {
      const res = await request(http)
        .get(`/platform/tenants/${tenantId}`)
        .set("Authorization", `Bearer ${platformToken}`)
        .expect(200);
      expect(res.body.userCount).toBe(1);
      expect(res.body.branches).toHaveLength(1);
    });

    it("404s for an unknown tenant id", async () => {
      await request(http)
        .get("/platform/tenants/00000000-0000-4000-8000-000000000000")
        .set("Authorization", `Bearer ${platformToken}`)
        .expect(404);
    });

    it("suspends a tenant, audit-logs it, and blocks that tenant's writes", async () => {
      await request(http)
        .patch(`/platform/tenants/${tenantId}/status`)
        .set("Authorization", `Bearer ${platformToken}`)
        .send({ status: "suspended" })
        .expect(200);

      const tenant = await admin.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      expect(tenant.status).toBe("suspended");

      const auditEntry = await admin.auditLog.findFirst({
        where: { tenantId, action: "tenant.suspended_by_platform" },
      });
      expect(auditEntry).not.toBeNull();
      expect(auditEntry?.meta).toMatchObject({ platformAdminEmail: "oversight@spruvex.internal" });

      await request(http)
        .get("/branches")
        .set("Authorization", `Bearer ${tenantOwnerToken}`)
        .expect(200); // reads still allowed
      await request(http)
        .post("/onboarding/branch")
        .set("Authorization", `Bearer ${tenantOwnerToken}`)
        .send({ name: "فرع جديد" })
        .expect(402); // writes blocked
    });

    it("reactivates the tenant", async () => {
      await request(http)
        .patch(`/platform/tenants/${tenantId}/status`)
        .set("Authorization", `Bearer ${platformToken}`)
        .send({ status: "active" })
        .expect(200);
      const tenant = await admin.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      expect(tenant.status).toBe("active");
    });

    it("lists subscriptions and updates status / plan", async () => {
      const list = await request(http)
        .get("/platform/subscriptions")
        .set("Authorization", `Bearer ${platformToken}`)
        .expect(200);
      const subscription = list.body.find((s: { tenant: { id: string } }) => s.tenant.id === tenantId);
      expect(subscription).toBeDefined();
      expect(subscription.status).toBe("trialing");

      const updated = await request(http)
        .patch(`/platform/subscriptions/${subscription.id}/status`)
        .set("Authorization", `Bearer ${platformToken}`)
        .send({ status: "active" })
        .expect(200);
      expect(updated.body.status).toBe("active");
      expect(updated.body.currentPeriodEnd).not.toBeNull();

      await request(http)
        .patch(`/platform/subscriptions/${subscription.id}/plan`)
        .set("Authorization", `Bearer ${platformToken}`)
        .send({ planKey: "growth" })
        .expect(200);

      const reloaded = await admin.subscription.findUniqueOrThrow({
        where: { id: subscription.id },
        include: { plan: true },
      });
      expect(reloaded.plan.key).toBe("growth");

      const auditEntry = await admin.auditLog.findFirst({
        where: { tenantId, action: "subscription.plan_changed_by_platform" },
      });
      expect(auditEntry?.meta).toMatchObject({ planKey: "growth" });
    });

    it("reports system status", async () => {
      const res = await request(http)
        .get("/platform/system-status")
        .set("Authorization", `Bearer ${platformToken}`)
        .expect(200);
      expect(res.body.database).toBe("ok");
      expect(res.body.tenants.total).toBeGreaterThanOrEqual(1);
      expect(res.body.subscriptions).toBeDefined();
    });
  });
});

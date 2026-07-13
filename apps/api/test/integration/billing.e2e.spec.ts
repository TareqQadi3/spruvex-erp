import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { AppModule } from "../../src/app.module";
import { syncPermissionCatalog } from "../../src/modules/tenancy/tenant-provisioning";
import { createOrderingFixtures } from "../helpers/catalog-fixtures";
import { createAdminClient, truncateAll } from "../helpers/db";
import { provisionTestTenant } from "../helpers/provision";

type Fixtures = Awaited<ReturnType<typeof createOrderingFixtures>>;

describe("billing: plans, subscriptions & limits (e2e)", () => {
  let app: INestApplication;
  let admin: PrismaClient;
  let http: ReturnType<INestApplication["getHttpServer"]>;

  const key = () => randomUUID();

  async function login(email: string): Promise<string> {
    const res = await request(http)
      .post("/auth/login")
      .send({ email, password: "Test-12345" })
      .expect(200);
    return res.body.tokens.accessToken;
  }

  beforeAll(async () => {
    admin = createAdminClient();
    await truncateAll(admin);
    await syncPermissionCatalog(admin);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
    await admin.$disconnect();
  });

  describe("plan catalog & subscription view", () => {
    let ownerToken = "";
    let cashierToken = "";

    beforeAll(async () => {
      const tenant = await provisionTestTenant(admin, {
        name: "مطعم الفوترة",
        slug: "bill-view",
        ownerEmail: "owner@bill-view.test",
      });
      const { hashPassword } = await import("../../src/modules/identity/password");
      const cashier = await admin.user.create({
        data: {
          email: "cashier@bill-view.test",
          name: "Cashier",
          passwordHash: await hashPassword("Test-12345"),
          emailVerifiedAt: new Date(),
        },
      });
      await admin.userRole.create({
        data: { tenantId: tenant.tenantId, userId: cashier.id, roleId: tenant.roleIdsByKey.cashier },
      });

      ownerToken = await login("owner@bill-view.test");
      cashierToken = await login("cashier@bill-view.test");
    });

    it("provisions every new tenant on a 14-day trial of the default plan", async () => {
      const res = await request(http)
        .get("/billing/subscription")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);
      expect(res.body.status).toBe("trialing");
      expect(res.body.plan.key).toBe("basic");
      expect(res.body.trialDaysRemaining).toBeGreaterThanOrEqual(13);
      expect(res.body.usage.branches).toBe(1);
      expect(res.body.usage.users).toBe(2); // owner + the cashier created in this block's beforeAll
    });

    it("lists the seeded plan catalog", async () => {
      const res = await request(http)
        .get("/billing/plans")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);
      expect(res.body.map((p: { key: string }) => p.key)).toEqual(
        expect.arrayContaining(["basic", "pro", "growth"]),
      );
    });

    it("denies billing.view/billing.manage to roles without them", async () => {
      await request(http)
        .get("/billing/subscription")
        .set("Authorization", `Bearer ${cashierToken}`)
        .expect(403);
      await request(http)
        .post("/billing/subscription/change-plan")
        .set("Authorization", `Bearer ${cashierToken}`)
        .send({ planKey: "pro" })
        .expect(403);
    });

    it("changes plan and reflects the new limits", async () => {
      const res = await request(http)
        .post("/billing/subscription/change-plan")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ planKey: "pro" })
        .expect(201);
      expect(res.body.planId).toBeDefined();

      const sub = await request(http)
        .get("/billing/subscription")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);
      expect(sub.body.plan.key).toBe("pro");
      expect(sub.body.plan.maxBranches).toBe(3);
    });

    it("rejects an unknown plan key", async () => {
      await request(http)
        .post("/billing/subscription/change-plan")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ planKey: "does-not-exist" })
        .expect(404);
    });
  });

  describe("branch limit enforcement", () => {
    let ownerToken = "";

    beforeAll(async () => {
      await provisionTestTenant(admin, {
        name: "مطعم حدود الفروع",
        slug: "bill-branches",
        ownerEmail: "owner@bill-branches.test",
      });
      ownerToken = await login("owner@bill-branches.test");
    });

    it("blocks adding a 2nd branch on the basic plan (limit = 1)", async () => {
      await request(http)
        .post("/onboarding/branch")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "فرع 2" })
        .expect(403);
    });

    it("allows it after upgrading to a plan with a higher branch limit", async () => {
      await request(http)
        .post("/billing/subscription/change-plan")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ planKey: "pro" })
        .expect(201);

      await request(http)
        .post("/onboarding/branch")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "فرع 2" })
        .expect(201);
    });
  });

  describe("user limit enforcement", () => {
    let ownerToken = "";

    beforeAll(async () => {
      await provisionTestTenant(admin, {
        name: "مطعم حدود المستخدمين",
        slug: "bill-users",
        ownerEmail: "owner@bill-users.test",
      });
      ownerToken = await login("owner@bill-users.test");
    });

    it("blocks adding staff that would exceed the basic plan's user limit (5)", async () => {
      // Tenant already has 1 member (the owner); adding 5 more would make 6 > 5.
      const users = Array.from({ length: 5 }, (_, i) => ({
        name: `Staff ${i}`,
        email: `staff${i}@bill-users.test`,
        password: "Test-12345",
        role: "cashier" as const,
      }));
      await request(http)
        .post("/onboarding/staff")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ users })
        .expect(403);
    });

    it("allows adding staff within the limit", async () => {
      const users = Array.from({ length: 4 }, (_, i) => ({
        name: `Staff ${i}`,
        email: `staff${i}@bill-users.test`,
        password: "Test-12345",
        role: "cashier" as const,
      }));
      await request(http)
        .post("/onboarding/staff")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ users })
        .expect(201);
    });
  });

  describe("monthly order limit enforcement", () => {
    let ownerToken = "";
    let branchId = "";
    let fx: Fixtures;

    beforeAll(async () => {
      const tenant = await provisionTestTenant(admin, {
        name: "مطعم حدود الطلبات",
        slug: "bill-orders",
        ownerEmail: "owner@bill-orders.test",
      });
      branchId = tenant.branchId!;
      fx = await createOrderingFixtures(admin, tenant.tenantId, branchId);
      ownerToken = await login("owner@bill-orders.test");

      // A throwaway plan with a tiny monthly order cap, reached through the
      // real change-plan endpoint like any other upgrade/downgrade. Upserted
      // — `plans` is a persistent global catalog, not truncated between runs.
      await admin.plan.upsert({
        where: { key: "test-order-cap" },
        update: {},
        create: {
          key: "test-order-cap",
          name: "خطة اختبار",
          nameEn: "Test cap plan",
          maxBranches: 10,
          maxUsers: 10,
          maxOrdersPerMonth: 2,
          priceMonthlyHalalas: 0,
        },
      });
      await request(http)
        .post("/billing/subscription/change-plan")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ planKey: "test-order-cap" })
        .expect(201);
    });

    function newOrder() {
      return request(http)
        .post("/orders")
        .set("Authorization", `Bearer ${ownerToken}`)
        .set("Idempotency-Key", key())
        .send({ type: "walkin", branchId, items: [{ productId: fx.simple.id, quantity: 1 }] });
    }

    it("allows orders up to the plan's monthly cap, then blocks further ones", async () => {
      await newOrder().expect(201);
      await newOrder().expect(201);
      await newOrder().expect(403);
    });
  });

  describe("tenant access gate (suspended tenant / inactive subscription)", () => {
    let ownerToken = "";
    let tenantId = "";
    let branchId = "";
    let fx: Fixtures;

    beforeAll(async () => {
      const tenant = await provisionTestTenant(admin, {
        name: "مطعم الحساب الموقوف",
        slug: "bill-gate",
        ownerEmail: "owner@bill-gate.test",
      });
      tenantId = tenant.tenantId;
      branchId = tenant.branchId!;
      fx = await createOrderingFixtures(admin, tenantId, branchId);
      ownerToken = await login("owner@bill-gate.test");
    });

    function newOrderRequest() {
      return request(http)
        .post("/orders")
        .set("Authorization", `Bearer ${ownerToken}`)
        .set("Idempotency-Key", key())
        .send({ type: "walkin", branchId, items: [{ productId: fx.simple.id, quantity: 1 }] });
    }

    it("blocks writes but allows reads once the tenant is suspended", async () => {
      await admin.tenant.update({ where: { id: tenantId }, data: { status: "suspended" } });

      await newOrderRequest().expect(402);
      await request(http)
        .get(`/orders?branchId=${branchId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      // Billing stays reachable so the owner can see why / what to do.
      await request(http)
        .get("/billing/subscription")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      await admin.tenant.update({ where: { id: tenantId }, data: { status: "active" } });
    });

    it("blocks writes when the subscription itself is cancelled", async () => {
      await admin.subscription.update({ where: { tenantId }, data: { status: "cancelled" } });
      await newOrderRequest().expect(402);
      await admin.subscription.update({ where: { tenantId }, data: { status: "trialing" } });
    });

    it("blocks writes once the trial has expired", async () => {
      await admin.subscription.update({
        where: { tenantId },
        data: { trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });
      await newOrderRequest().expect(402);
    });

    it("writes succeed again once reactivated", async () => {
      await admin.subscription.update({
        where: { tenantId },
        data: { status: "active", trialEndsAt: null },
      });
      await newOrderRequest().expect(201);
    });
  });
});

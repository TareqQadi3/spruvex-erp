import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { AppModule } from "../../src/app.module";
import { syncPermissionCatalog } from "../../src/modules/tenancy/tenant-provisioning";
import { createOrderingFixtures } from "../helpers/catalog-fixtures";
import { createAdminClient, truncateAll } from "../helpers/db";
import { setupUnits } from "../helpers/inventory-fixtures";
import { provisionTestTenant } from "../helpers/provision";

type Fixtures = Awaited<ReturnType<typeof createOrderingFixtures>>;

describe("reports & analytics (e2e)", () => {
  let app: INestApplication;
  let admin: PrismaClient;
  let http: ReturnType<INestApplication["getHttpServer"]>;

  let ownerA = "";
  let cashierA = ""; // no reports.view
  let ownerB = "";
  let tenantAId = "";
  let branchA = "";
  let fx: Fixtures;

  const key = () => randomUUID();

  async function login(email: string): Promise<string> {
    const res = await request(http)
      .post("/auth/login")
      .send({ email, password: "Test-12345" })
      .expect(200);
    return res.body.tokens.accessToken;
  }

  async function newOrder(token: string, items: Array<Record<string, unknown>>) {
    const res = await request(http)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", key())
      .send({ type: "walkin", branchId: branchA, confirm: true, items })
      .expect(201);
    return res.body;
  }

  async function payInFull(token: string, orderId: string, amount: string) {
    await request(http)
      .post(`/orders/${orderId}/payments`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", key())
      .send({ method: "cash", amount })
      .expect(201);
  }

  beforeAll(async () => {
    admin = createAdminClient();
    await truncateAll(admin);
    await syncPermissionCatalog(admin);
    const units = await setupUnits(admin);

    const tenantA = await provisionTestTenant(admin, {
      name: "مطعم التقارير",
      slug: "rpt-a",
      ownerEmail: "owner@rpt-a.test",
    });
    tenantAId = tenantA.tenantId;
    branchA = tenantA.branchId!;
    await provisionTestTenant(admin, {
      name: "مطعم آخر",
      slug: "rpt-b",
      ownerEmail: "owner@rpt-b.test",
    });

    const { hashPassword } = await import("../../src/modules/identity/password");
    const cashier = await admin.user.create({
      data: {
        email: "cashier@rpt-a.test",
        name: "Cashier A",
        passwordHash: await hashPassword("Test-12345"),
        emailVerifiedAt: new Date(),
      },
    });
    await admin.userRole.create({
      data: {
        tenantId: tenantAId,
        userId: cashier.id,
        roleId: tenantA.roleIdsByKey.cashier,
        branchId: branchA,
      },
    });

    fx = await createOrderingFixtures(admin, tenantAId, branchA);

    // Recipe + stock for fx.simple (12.00 SAR), so financial/food-cost reports have real data.
    const cheese = await admin.ingredient.create({
      data: { tenantId: tenantAId, name: "جبن", nameEn: "Cheese", unitType: "mass", createdBy: cashier.id },
    });
    await admin.recipeItem.createMany({
      data: [{ tenantId: tenantAId, productId: fx.simple.id, ingredientId: cheese.id, unitId: units.gram.id, quantity: "200", createdBy: cashier.id }],
    });
    const location = await admin.stockLocation.create({
      data: { tenantId: tenantAId, branchId: branchA, name: "المخزن", isDefault: true, createdBy: cashier.id },
    });
    await admin.stockMovement.create({
      data: {
        tenantId: tenantAId,
        branchId: branchA,
        locationId: location.id,
        ingredientId: cheese.id,
        type: "purchase",
        quantity: "5000",
        unitCost: "0.05",
        performedBy: cashier.id,
      },
    });
    await admin.stockLevel.create({
      data: { tenantId: tenantAId, branchId: branchA, locationId: location.id, ingredientId: cheese.id, quantity: "5000" },
    });
    await admin.ingredient.update({ where: { id: cheese.id }, data: { averageCost: "0.05" } });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    http = app.getHttpServer();

    ownerA = await login("owner@rpt-a.test");
    ownerB = await login("owner@rpt-b.test");
    cashierA = await login("cashier@rpt-a.test");

    await request(http)
      .post("/shifts/open")
      .set("Authorization", `Bearer ${cashierA}`)
      .send({ branchId: branchA, openingCash: "0" })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
    await admin.$disconnect();
  });

  describe("permissions", () => {
    it("denies reports.view to roles without it", async () => {
      await request(http)
        .get("/reports/sales/daily")
        .set("Authorization", `Bearer ${cashierA}`)
        .expect(403);
    });
  });

  describe("sales reports", () => {
    it("reports zero sales before any order exists today", async () => {
      const res = await request(http)
        .get(`/reports/sales/daily?branchId=${branchA}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      expect(res.body.orderCount).toBe(0);
      expect(res.body.total).toBe("0.00");
    });

    it("aggregates completed orders into daily sales and best sellers", async () => {
      // Order 1: 2x simple (12.00 each, recipe'd) = 24.00
      const order1 = await newOrder(cashierA, [{ productId: fx.simple.id, quantity: 2 }]);
      await payInFull(cashierA, order1.id, order1.total);

      // Order 2: 1x withSize + large modifier (35.00) = 35.00
      const order2 = await newOrder(cashierA, [
        { productId: fx.withSize.id, quantity: 1, modifierIds: [fx.large.id] },
      ]);
      await payInFull(cashierA, order2.id, order2.total);

      // Order 3: created but left unpaid — must NOT count towards completed sales.
      await newOrder(cashierA, [{ productId: fx.simple.id, quantity: 1 }]);

      const sales = await request(http)
        .get(`/reports/sales/daily?branchId=${branchA}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      expect(sales.body.orderCount).toBe(2);
      expect(sales.body.total).toBe("59.00"); // 24 + 35
      expect(sales.body.avgOrderValue).toBe("29.50");

      const best = await request(http)
        .get(`/reports/sales/best-sellers?branchId=${branchA}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      const simpleEntry = best.body.find((b: { productId: string }) => b.productId === fx.simple.id);
      expect(simpleEntry.quantitySold).toBe(2);
      expect(simpleEntry.revenue).toBe("24.00");
    });

    it("tenant isolation: tenant B sees no sales for tenant A's branch", async () => {
      const res = await request(http)
        .get(`/reports/sales/daily?branchId=${branchA}`)
        .set("Authorization", `Bearer ${ownerB}`)
        .expect(200);
      expect(res.body.orderCount).toBe(0);
    });
  });

  describe("operations report", () => {
    it("counts completed vs cancelled orders and computes average prep time", async () => {
      // Left unconfirmed at creation, then walked through every transition
      // explicitly — `orderStatusHistory` rows (and thus prep-time data) are
      // only written by the `transition()` step, not by `confirm: true`.
      const created = await request(http)
        .post("/orders")
        .set("Authorization", `Bearer ${cashierA}`)
        .set("Idempotency-Key", key())
        .send({ type: "walkin", branchId: branchA, items: [{ productId: fx.simple.id, quantity: 1 }] })
        .expect(201);
      const order = created.body;
      for (const status of ["confirmed", "preparing", "ready"]) {
        await request(http)
          .post(`/orders/${order.id}/status`)
          .set("Authorization", `Bearer ${ownerA}`)
          .send({ status })
          .expect(200);
      }
      await payInFull(cashierA, order.id, order.total);

      const cancelOrder = await newOrder(cashierA, [{ productId: fx.simple.id, quantity: 1 }]);
      await request(http)
        .post(`/orders/${cancelOrder.id}/status`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ status: "cancelled", reason: "test" })
        .expect(200);

      const res = await request(http)
        .get(`/reports/operations?branchId=${branchA}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      expect(res.body.orderCount).toBeGreaterThanOrEqual(3); // includes prior sales-report orders
      expect(res.body.cancelledCount).toBeGreaterThanOrEqual(1);
      expect(res.body.avgPrepTimeMinutes).not.toBeNull();
    });
  });

  describe("financial report", () => {
    it("computes revenue, VAT, discounts and food-cost/margin summary", async () => {
      const res = await request(http)
        .get(`/reports/financial?branchId=${branchA}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      // VAT is a pass-through: revenue = total - vat.
      expect(Number(res.body.total)).toBeCloseTo(
        Number(res.body.revenue) + Number(res.body.vatCollected),
        2,
      );
      // Food cost > 0 because recipe'd `simple` products were sold.
      expect(Number(res.body.foodCost)).toBeGreaterThan(0);
      expect(Number(res.body.grossMargin)).toBeLessThan(Number(res.body.revenue));
    });

    it("reflects discounts applied to orders", async () => {
      const before = await request(http)
        .get(`/reports/financial?branchId=${branchA}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);

      const order = await newOrder(ownerA, [{ productId: fx.simple.id, quantity: 1 }]);
      const discounted = await request(http)
        .post(`/orders/${order.id}/discount`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ type: "fixed", value: "2.00", reason: "test" })
        .expect(200);
      await payInFull(cashierA, order.id, discounted.body.total);

      const after = await request(http)
        .get(`/reports/financial?branchId=${branchA}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      expect(Number(after.body.discounts)).toBeCloseTo(Number(before.body.discounts) + 2, 2);
    });
  });

  describe("dashboard summary", () => {
    it("combines today's sales, best sellers and low-stock alerts", async () => {
      // Push cheese stock below its reorder level to trigger a low-stock alert.
      const cheese = await admin.ingredient.findFirstOrThrow({
        where: { tenantId: tenantAId, name: "جبن" },
      });
      await admin.ingredient.update({ where: { id: cheese.id }, data: { reorderLevel: "100000" } });

      const res = await request(http)
        .get(`/reports/dashboard-summary?branchId=${branchA}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      expect(res.body.todaySales.orderCount).toBeGreaterThan(0);
      expect(Array.isArray(res.body.bestSellers)).toBe(true);
      expect(res.body.lowStockAlerts.some((a: { name: string }) => a.name === "جبن")).toBe(true);
    });

    it("cashier without reports.view is denied the dashboard summary", async () => {
      await request(http)
        .get(`/reports/dashboard-summary?branchId=${branchA}`)
        .set("Authorization", `Bearer ${cashierA}`)
        .expect(403);
    });
  });
});

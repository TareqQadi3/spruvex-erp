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

describe("shifts, payments & checkout (e2e)", () => {
  let app: INestApplication;
  let admin: PrismaClient;
  let http: ReturnType<INestApplication["getHttpServer"]>;

  let ownerA = ""; // all permissions (incl. orders.discount)
  let cashierA = ""; // payments.record + shifts, NO orders.discount
  let ownerB = "";
  let branchA = "";
  let fx: Fixtures;
  let cashierShiftId = "";

  const key = () => randomUUID();

  async function login(email: string): Promise<string> {
    const res = await request(http)
      .post("/auth/login")
      .send({ email, password: "Test-12345" })
      .expect(200);
    return res.body.tokens.accessToken;
  }

  async function newOrder(token: string, extras: Record<string, unknown> = {}) {
    const res = await request(http)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", key())
      .send({
        type: "walkin",
        branchId: branchA,
        confirm: true,
        items: [
          { productId: fx.withSize.id, quantity: 2, modifierIds: [fx.large.id] }, // 70.00
          { productId: fx.simple.id, quantity: 1 }, // 12.00
        ],
        ...extras,
      })
      .expect(201);
    return res.body; // total 82.00
  }

  function pay(
    token: string,
    orderId: string,
    body: Record<string, unknown>,
    idem = key(),
  ) {
    return request(http)
      .post(`/orders/${orderId}/payments`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", idem)
      .send(body);
  }

  beforeAll(async () => {
    admin = createAdminClient();
    await truncateAll(admin);
    await syncPermissionCatalog(admin);

    const tenantA = await provisionTestTenant(admin, {
      name: "مطعم ألف",
      slug: "pay-a",
      ownerEmail: "owner@pay-a.test",
    });
    branchA = tenantA.branchId!;
    await provisionTestTenant(admin, {
      name: "مطعم باء",
      slug: "pay-b",
      ownerEmail: "owner@pay-b.test",
    });

    const { hashPassword } = await import("../../src/modules/identity/password");
    const cashier = await admin.user.create({
      data: {
        email: "cashier@pay-a.test",
        name: "Cashier A",
        passwordHash: await hashPassword("Test-12345"),
        emailVerifiedAt: new Date(),
      },
    });
    await admin.userRole.create({
      data: {
        tenantId: tenantA.tenantId,
        userId: cashier.id,
        roleId: tenantA.roleIdsByKey.cashier,
        branchId: branchA,
      },
    });

    fx = await createOrderingFixtures(admin, tenantA.tenantId, branchA);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    http = app.getHttpServer();

    ownerA = await login("owner@pay-a.test");
    ownerB = await login("owner@pay-b.test");
    cashierA = await login("cashier@pay-a.test");
  });

  afterAll(async () => {
    await app.close();
    await admin.$disconnect();
  });

  describe("cashier shifts", () => {
    it("rejects payments while no shift is open", async () => {
      const order = await newOrder(cashierA);
      await pay(cashierA, order.id, { method: "cash", amount: "82.00" }).expect(409);
    });

    it("opens a shift with an opening float (audited)", async () => {
      const res = await request(http)
        .post("/shifts/open")
        .set("Authorization", `Bearer ${cashierA}`)
        .send({ branchId: branchA, openingCash: "200.00" })
        .expect(201);
      cashierShiftId = res.body.id;
      expect(res.body.closedAt).toBeNull();

      const audit = await admin.auditLog.findFirst({
        where: { action: "shift.opened", entityId: cashierShiftId },
      });
      expect(audit).not.toBeNull();
    });

    it("prevents a second open shift for the same cashier+branch", async () => {
      await request(http)
        .post("/shifts/open")
        .set("Authorization", `Bearer ${cashierA}`)
        .send({ branchId: branchA, openingCash: "0" })
        .expect(409);
    });

    it("reports the current shift", async () => {
      const res = await request(http)
        .get(`/shifts/current?branchId=${branchA}`)
        .set("Authorization", `Bearer ${cashierA}`)
        .expect(200);
      expect(res.body.id).toBe(cashierShiftId);
    });
  });

  describe("payments & checkout", () => {
    it("split payment: partial cash then card completes the order", async () => {
      const order = await newOrder(cashierA);

      const first = await pay(cashierA, order.id, { method: "cash", amount: "50.00" }).expect(201);
      expect(first.body.paid).toBe("50.00");
      expect(first.body.remaining).toBe("32.00");
      expect(first.body.status).toBe("confirmed"); // partial — still open

      const second = await pay(cashierA, order.id, {
        method: "card",
        amount: "32.00",
        reference: "APPROVAL-123",
      }).expect(201);
      expect(second.body.remaining).toBe("0.00");
      expect(second.body.payments).toHaveLength(2);

      const completed = await admin.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(completed.status).toBe("completed"); // auto-completed on full payment
    });

    it("prevents overpayment (amount above remaining balance)", async () => {
      const order = await newOrder(cashierA);
      await pay(cashierA, order.id, { method: "cash", amount: "100.00" }).expect(400);
      await pay(cashierA, order.id, { method: "cash", amount: "82.00" }).expect(201);
      // Fully paid — any further payment rejected (duplicate prevention).
      await pay(cashierA, order.id, { method: "cash", amount: "0.01" }).expect(409);
    });

    it("is idempotent per Idempotency-Key (no double charge)", async () => {
      const order = await newOrder(cashierA);
      const idem = key();
      const first = await pay(cashierA, order.id, { method: "cash", amount: "40.00" }, idem).expect(201);
      const replay = await pay(cashierA, order.id, { method: "cash", amount: "40.00" }, idem).expect(201);
      expect(replay.body.payment.id).toBe(first.body.payment.id);

      const rows = await admin.payment.findMany({ where: { orderId: order.id } });
      expect(rows).toHaveLength(1);
    });

    it("cannot complete an order without full payment (machine guard)", async () => {
      const order = await newOrder(ownerA);
      await request(http)
        .post(`/orders/${order.id}/status`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ status: "completed" })
        .expect(409);
    });

    it("cannot cancel an order that has payments", async () => {
      const order = await newOrder(cashierA);
      await pay(cashierA, order.id, { method: "cash", amount: "10.00" }).expect(201);
      await request(http)
        .post(`/orders/${order.id}/status`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ status: "cancelled", reason: "test" })
        .expect(409);
    });

    it("rejects payment on unconfirmed orders", async () => {
      const res = await request(http)
        .post("/orders")
        .set("Authorization", `Bearer ${cashierA}`)
        .set("Idempotency-Key", key())
        .send({
          type: "walkin",
          branchId: branchA,
          items: [{ productId: fx.simple.id, quantity: 1 }],
        })
        .expect(201);
      expect(res.body.status).toBe("new");
      await pay(cashierA, res.body.id, { method: "cash", amount: "12.00" }).expect(409);
    });

    it("audits every payment", async () => {
      const count = await admin.auditLog.count({ where: { action: "payment.recorded" } });
      expect(count).toBeGreaterThanOrEqual(4);
    });
  });

  describe("receipts", () => {
    it("issues a numbered receipt with restaurant info and VAT fields", async () => {
      const order = await newOrder(cashierA);
      await pay(cashierA, order.id, { method: "cash", amount: "82.00" }).expect(201);

      const res = await request(http)
        .get(`/orders/${order.id}/receipt`)
        .set("Authorization", `Bearer ${cashierA}`)
        .expect(200);
      expect(res.body.receiptNumber).toBeGreaterThan(0);
      expect(res.body.vatRate).toBe("15");
      expect(res.body.payload.restaurant.name).toBe("مطعم ألف");
      expect(res.body.payload.totals.total).toBe("82");
      expect(res.body.payload.payments).toHaveLength(1);

      // Idempotent: same receipt on refetch.
      const again = await request(http)
        .get(`/orders/${order.id}/receipt`)
        .set("Authorization", `Bearer ${cashierA}`)
        .expect(200);
      expect(again.body.id).toBe(res.body.id);
    });

    it("receipt numbers are sequential per branch", async () => {
      const receipts = await admin.receipt.findMany({
        where: { branchId: branchA },
        orderBy: { receiptNumber: "asc" },
      });
      expect(receipts.map((r) => r.receiptNumber)).toEqual(
        receipts.map((_, index) => index + 1),
      );
    });

    it("refuses receipts for uncompleted orders", async () => {
      const order = await newOrder(cashierA);
      await request(http)
        .get(`/orders/${order.id}/receipt`)
        .set("Authorization", `Bearer ${cashierA}`)
        .expect(409);
    });
  });

  describe("discounts", () => {
    it("cashier without orders.discount is denied", async () => {
      const order = await newOrder(cashierA);
      await request(http)
        .post(`/orders/${order.id}/discount`)
        .set("Authorization", `Bearer ${cashierA}`)
        .send({ type: "percentage", value: "10", reason: "زبون دائم" })
        .expect(403);
    });

    it("applies a percentage discount with recomputed totals + audit", async () => {
      const order = await newOrder(ownerA);
      const res = await request(http)
        .post(`/orders/${order.id}/discount`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ type: "percentage", value: "10", reason: "زبون دائم" })
        .expect(200);
      // 82.00 - 10% = 73.80; VAT inclusive = 73.80*15/115 = 9.63
      expect(res.body.discount).toBe("8.2");
      expect(res.body.total).toBe("73.8");
      expect(res.body.vatAmount).toBe("9.63");

      const audit = await admin.auditLog.findFirst({
        where: { action: "order.discount_applied", entityId: order.id },
      });
      expect(audit?.meta).toMatchObject({ reason: "زبون دائم", type: "percentage" });
    });

    it("rejects discounts above the configurable limit (default 20%)", async () => {
      const order = await newOrder(ownerA);
      await request(http)
        .post(`/orders/${order.id}/discount`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ type: "percentage", value: "25", reason: "كبير" })
        .expect(400);
      // Fixed amount equivalent to >20% is rejected too (82 * 0.25 = 20.50).
      await request(http)
        .post(`/orders/${order.id}/discount`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ type: "fixed", value: "20.50", reason: "كبير" })
        .expect(400);
    });

    it("applies a fixed discount and pays the discounted total", async () => {
      const order = await newOrder(cashierA);
      const res = await request(http)
        .post(`/orders/${order.id}/discount`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ type: "fixed", value: "12.00", reason: "تعويض تأخير" })
        .expect(200);
      expect(res.body.total).toBe("70");

      await pay(cashierA, order.id, { method: "cash", amount: "70.00" }).expect(201);
      const completed = await admin.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(completed.status).toBe("completed");
    });

    it("blocks discounts after a payment exists", async () => {
      const order = await newOrder(cashierA);
      await pay(cashierA, order.id, { method: "cash", amount: "20.00" }).expect(201);
      await request(http)
        .post(`/orders/${order.id}/discount`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ type: "percentage", value: "5", reason: "x" })
        .expect(409);
    });
  });

  describe("order editing before confirmation", () => {
    it("replaces items while status=new, recomputing totals", async () => {
      const created = await request(http)
        .post("/orders")
        .set("Authorization", `Bearer ${cashierA}`)
        .set("Idempotency-Key", key())
        .send({
          type: "walkin",
          branchId: branchA,
          items: [{ productId: fx.simple.id, quantity: 1 }],
        })
        .expect(201);
      expect(created.body.total).toBe("12");

      const edited = await request(http)
        .put(`/orders/${created.body.id}/items`)
        .set("Authorization", `Bearer ${cashierA}`)
        .send({
          items: [
            { productId: fx.simple.id, quantity: 2 },
            { productId: fx.withSize.id, quantity: 1, modifierIds: [fx.regular.id] },
          ],
        })
        .expect(200);
      expect(edited.body.total).toBe("54"); // 24 + 30
      expect(edited.body.items).toHaveLength(2);
    });

    it("rejects editing once confirmed", async () => {
      const order = await newOrder(cashierA);
      await request(http)
        .put(`/orders/${order.id}/items`)
        .set("Authorization", `Bearer ${cashierA}`)
        .send({ items: [{ productId: fx.simple.id, quantity: 1 }] })
        .expect(409);
    });
  });

  describe("shift close & tenant isolation", () => {
    it("tenant B cannot pay or view tenant A payments", async () => {
      const order = await newOrder(cashierA);
      await request(http)
        .get(`/orders/${order.id}/payments`)
        .set("Authorization", `Bearer ${ownerB}`)
        .expect(404);
      await pay(ownerB, order.id, { method: "cash", amount: "1.00" }).expect(404);
    });

    it("closes the shift with expected cash = float + cash payments", async () => {
      const cashTaken = await admin.payment.aggregate({
        where: { shiftId: cashierShiftId, method: "cash", status: "completed" },
        _sum: { amount: true },
      });
      const expected = 200 + Number(cashTaken._sum.amount ?? 0);

      const res = await request(http)
        .post(`/shifts/${cashierShiftId}/close`)
        .set("Authorization", `Bearer ${cashierA}`)
        .send({ actualCash: expected.toFixed(2) })
        .expect(200);
      expect(Number(res.body.expectedCash)).toBe(expected);
      expect(Number(res.body.difference)).toBe(0);
      expect(res.body.closedAt).not.toBeNull();

      // Payments after close are rejected (no open shift).
      const order = await newOrder(cashierA);
      await pay(cashierA, order.id, { method: "cash", amount: "82.00" }).expect(409);
    });
  });
});

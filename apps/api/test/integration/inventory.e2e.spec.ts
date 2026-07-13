import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { AppModule } from "../../src/app.module";
import { InventoryService } from "../../src/modules/inventory/inventory.service";
import { syncPermissionCatalog } from "../../src/modules/tenancy/tenant-provisioning";
import { createOrderingFixtures } from "../helpers/catalog-fixtures";
import { createAdminClient, truncateAll } from "../helpers/db";
import { setupUnits } from "../helpers/inventory-fixtures";
import { provisionTestTenant } from "../helpers/provision";

type Fixtures = Awaited<ReturnType<typeof createOrderingFixtures>>;
type Units = Awaited<ReturnType<typeof setupUnits>>;

/** Polls until `check` returns a truthy value or the timeout elapses. */
async function waitUntil<T>(check: () => Promise<T | null | undefined>, timeoutMs = 4000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await check();
    if (result) return result;
    if (Date.now() > deadline) {
      throw new Error("waitUntil: condition not met before timeout");
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe("inventory, recipes & food cost (e2e)", () => {
  let app: INestApplication;
  let admin: PrismaClient;
  let http: ReturnType<INestApplication["getHttpServer"]>;

  let ownerA = ""; // all permissions
  let cashierA = ""; // no inventory.*/recipes.manage/reports.view
  let ownerB = "";
  let tenantAId = "";
  let branchA = "";
  let fx: Fixtures;
  let units: Units;

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
    units = await setupUnits(admin);

    const tenantA = await provisionTestTenant(admin, {
      name: "مطعم المخزون",
      slug: "inv-a",
      ownerEmail: "owner@inv-a.test",
    });
    tenantAId = tenantA.tenantId;
    branchA = tenantA.branchId!;
    await provisionTestTenant(admin, {
      name: "مطعم آخر",
      slug: "inv-b",
      ownerEmail: "owner@inv-b.test",
    });

    const { hashPassword } = await import("../../src/modules/identity/password");
    const cashier = await admin.user.create({
      data: {
        email: "cashier@inv-a.test",
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

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    http = app.getHttpServer();

    ownerA = await login("owner@inv-a.test");
    ownerB = await login("owner@inv-b.test");
    cashierA = await login("cashier@inv-a.test");

    // Payments require an open shift — needed for the auto-deduction tests below.
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

  describe("unit catalog", () => {
    it("lists the seeded global units", async () => {
      const res = await request(http)
        .get("/inventory/units")
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      const codes = res.body.map((u: { code: string }) => u.code);
      expect(codes).toEqual(expect.arrayContaining(["g", "kg", "ml", "l", "pc"]));
    });

    it("denies inventory.view to roles without it", async () => {
      await request(http)
        .get("/inventory/units")
        .set("Authorization", `Bearer ${cashierA}`)
        .expect(403);
    });
  });

  describe("ingredients", () => {
    let flourId = "";

    it("cashier cannot create ingredients", async () => {
      await request(http)
        .post("/inventory/ingredients")
        .set("Authorization", `Bearer ${cashierA}`)
        .send({ name: "دقيق", unitType: "mass" })
        .expect(403);
    });

    it("creates an ingredient", async () => {
      const res = await request(http)
        .post("/inventory/ingredients")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ name: "دقيق", nameEn: "Flour", unitType: "mass", reorderLevel: "500" })
        .expect(201);
      flourId = res.body.id;
      expect(res.body.averageCost).toBe("0"); // Prisma Decimal strips trailing zeros

      const audit = await admin.auditLog.findFirst({
        where: { action: "ingredient.created", entityId: flourId },
      });
      expect(audit).not.toBeNull();
    });

    it("rejects an invalid unitType", async () => {
      await request(http)
        .post("/inventory/ingredients")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ name: "x", unitType: "invalid" })
        .expect(400);
    });

    it("lists and reads ingredients", async () => {
      const list = await request(http)
        .get("/inventory/ingredients")
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      expect(list.body.some((i: { id: string }) => i.id === flourId)).toBe(true);

      const one = await request(http)
        .get(`/inventory/ingredients/${flourId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      expect(one.body.name).toBe("دقيق");
    });

    it("updates an ingredient (unitType cannot be changed)", async () => {
      const res = await request(http)
        .patch(`/inventory/ingredients/${flourId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ reorderLevel: "1000" })
        .expect(200);
      expect(res.body.reorderLevel).toBe("1000");

      // Accepted (unitType isn't rejected by validation), but silently ignored —
      // the measurement family is immutable once ingredients/recipes reference it.
      const attempt = await request(http)
        .patch(`/inventory/ingredients/${flourId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ unitType: "volume" })
        .expect(200);
      expect(attempt.body.unitType).toBe("mass");
    });

    it("tenant B cannot see tenant A's ingredients", async () => {
      await request(http)
        .get(`/inventory/ingredients/${flourId}`)
        .set("Authorization", `Bearer ${ownerB}`)
        .expect(404);
      const list = await request(http)
        .get("/inventory/ingredients")
        .set("Authorization", `Bearer ${ownerB}`)
        .expect(200);
      expect(list.body).toHaveLength(0);
    });

    it("blocks soft-delete while used in a recipe, allows it once removed", async () => {
      await request(http)
        .put(`/products/${fx.simple.id}/recipe`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ items: [{ ingredientId: flourId, unitId: units.gram.id, quantity: "50" }] })
        .expect(200);

      await request(http)
        .delete(`/inventory/ingredients/${flourId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(409);

      await request(http)
        .put(`/products/${fx.simple.id}/recipe`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ items: [] })
        .expect(200);

      await request(http)
        .delete(`/inventory/ingredients/${flourId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
    });
  });

  describe("stock locations", () => {
    let secondaryLocationId = "";

    it("creates a location and enforces a single default per branch", async () => {
      const locations = await admin.stockLocation.findMany({ where: { tenantId: tenantAId } });
      expect(locations).toHaveLength(0); // none yet — lazy creation not triggered

      const res = await request(http)
        .post("/inventory/locations")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ branchId: branchA, name: "المخزن الرئيسي", isDefault: true })
        .expect(201);
      const mainId = res.body.id;

      const second = await request(http)
        .post("/inventory/locations")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ branchId: branchA, name: "الفريزر", nameEn: "Freezer", isDefault: true })
        .expect(201);
      secondaryLocationId = second.body.id;

      const main = await admin.stockLocation.findUniqueOrThrow({ where: { id: mainId } });
      expect(main.isDefault).toBe(false); // superseded by the new default
    });

    it("lists locations for a branch", async () => {
      const res = await request(http)
        .get(`/inventory/locations?branchId=${branchA}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      expect(res.body).toHaveLength(2);
    });

    it("cashier is denied location management", async () => {
      await request(http)
        .post("/inventory/locations")
        .set("Authorization", `Bearer ${cashierA}`)
        .send({ branchId: branchA, name: "x" })
        .expect(403);
    });

    it("blocks deleting a location that still holds stock (checked after purchase below)", async () => {
      // Placeholder ordering — real assertion happens in the movements block,
      // after stock has been purchased into secondaryLocationId.
      expect(secondaryLocationId).not.toBe("");
    });
  });

  describe("stock movements", () => {
    let sugarId = "";
    let mainLocationId = "";

    beforeAll(async () => {
      const ingredient = await request(http)
        .post("/inventory/ingredients")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ name: "سكر", nameEn: "Sugar", unitType: "mass" })
        .expect(201);
      sugarId = ingredient.body.id;

      const location = await admin.stockLocation.findFirstOrThrow({
        where: { tenantId: tenantAId, isDefault: true },
      });
      mainLocationId = location.id;
    });

    it("cashier cannot record stock movements", async () => {
      await request(http)
        .post("/inventory/stock/purchase")
        .set("Authorization", `Bearer ${cashierA}`)
        .send({ branchId: branchA, ingredientId: sugarId, quantity: "1000", unitCost: "0.05" })
        .expect(403);
    });

    it("records a purchase, updates the weighted-average cost and the stock level", async () => {
      const res = await request(http)
        .post("/inventory/stock/purchase")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({
          branchId: branchA,
          ingredientId: sugarId,
          locationId: mainLocationId,
          quantity: "1000",
          unitCost: "0.05",
          reason: "شراء أولي",
        })
        .expect(201);
      expect(res.body.type).toBe("purchase");
      expect(res.body.quantity).toBe("1000");

      const ingredient = await admin.ingredient.findUniqueOrThrow({ where: { id: sugarId } });
      expect(ingredient.averageCost.toString()).toBe("0.05");

      const level = await admin.stockLevel.findUniqueOrThrow({
        where: { locationId_ingredientId: { locationId: mainLocationId, ingredientId: sugarId } },
      });
      expect(level.quantity.toString()).toBe("1000");
    });

    it("blends the average cost on a second purchase at a different price", async () => {
      // Prior: 1000g @ 0.05. New: 1000g @ 0.09 -> blended = (1000*0.05+1000*0.09)/2000 = 0.07
      await request(http)
        .post("/inventory/stock/purchase")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({
          branchId: branchA,
          ingredientId: sugarId,
          locationId: mainLocationId,
          quantity: "1000",
          unitCost: "0.09",
        })
        .expect(201);

      const ingredient = await admin.ingredient.findUniqueOrThrow({ where: { id: sugarId } });
      expect(ingredient.averageCost.toString()).toBe("0.07");
    });

    it("requires a reason for waste, then deducts stock", async () => {
      await request(http)
        .post("/inventory/stock/waste")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ branchId: branchA, ingredientId: sugarId, locationId: mainLocationId, quantity: "200" })
        .expect(400); // reason missing

      await request(http)
        .post("/inventory/stock/waste")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({
          branchId: branchA,
          ingredientId: sugarId,
          locationId: mainLocationId,
          quantity: "200",
          reason: "تلف",
        })
        .expect(201);

      const level = await admin.stockLevel.findUniqueOrThrow({
        where: { locationId_ingredientId: { locationId: mainLocationId, ingredientId: sugarId } },
      });
      expect(level.quantity.toString()).toBe("1800"); // 2000 - 200
    });

    it("rejects a no-op adjustment, then applies a real one", async () => {
      await request(http)
        .post("/inventory/stock/adjustment")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({
          branchId: branchA,
          ingredientId: sugarId,
          locationId: mainLocationId,
          countedQuantity: "1800",
          reason: "جرد",
        })
        .expect(400);

      const res = await request(http)
        .post("/inventory/stock/adjustment")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({
          branchId: branchA,
          ingredientId: sugarId,
          locationId: mainLocationId,
          countedQuantity: "1750",
          reason: "جرد",
        })
        .expect(201);
      expect(res.body.quantity).toBe("-50");

      const level = await admin.stockLevel.findUniqueOrThrow({
        where: { locationId_ingredientId: { locationId: mainLocationId, ingredientId: sugarId } },
      });
      expect(level.quantity.toString()).toBe("1750");
    });

    it("exposes stock levels and movement history", async () => {
      const levels = await request(http)
        .get(`/inventory/stock-levels?branchId=${branchA}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      expect(levels.body.some((l: { ingredientId: string }) => l.ingredientId === sugarId)).toBe(true);

      const movements = await request(http)
        .get(`/inventory/movements?branchId=${branchA}&ingredientId=${sugarId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      expect(movements.body.length).toBeGreaterThanOrEqual(4); // 2 purchases + waste + adjustment
    });

    it("blocks deleting a location that still holds stock", async () => {
      await request(http)
        .delete(`/inventory/locations/${mainLocationId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(409);
    });

    it("every movement is audit tracked", async () => {
      const count = await admin.auditLog.count({
        where: {
          tenantId: tenantAId,
          action: { in: ["stock.purchase_recorded", "stock.waste_recorded", "stock.adjustment_recorded"] },
        },
      });
      expect(count).toBeGreaterThanOrEqual(4);
    });

    it("tenant isolation: tenant B has no access to tenant A movements/levels", async () => {
      const levels = await request(http)
        .get(`/inventory/stock-levels?branchId=${branchA}`)
        .set("Authorization", `Bearer ${ownerB}`)
        .expect(200);
      expect(levels.body).toHaveLength(0);

      await request(http)
        .post("/inventory/stock/purchase")
        .set("Authorization", `Bearer ${ownerB}`)
        .send({ branchId: branchA, ingredientId: sugarId, quantity: "10", unitCost: "0.01" })
        .expect(404); // ingredient not found under tenant B's RLS scope
    });
  });

  describe("recipes & food cost", () => {
    let ingredientId = "";

    beforeAll(async () => {
      const res = await request(http)
        .post("/inventory/ingredients")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ name: "جبن", nameEn: "Cheese", unitType: "mass" })
        .expect(201);
      ingredientId = res.body.id;

      // Cost per gram = 0.05 SAR (moving average starts at this purchase price).
      await request(http)
        .post("/inventory/stock/purchase")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ branchId: branchA, ingredientId, quantity: "5000", unitCost: "0.05" })
        .expect(201);
    });

    it("rejects a unit whose measurement type does not match the ingredient", async () => {
      await request(http)
        .put(`/products/${fx.simple.id}/recipe`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ items: [{ ingredientId, unitId: units.piece.id, quantity: "1" }] })
        .expect(400); // piece (count) vs cheese (mass)
    });

    it("cashier cannot manage recipes but can still view menu-level recipe reads", async () => {
      await request(http)
        .put(`/products/${fx.simple.id}/recipe`)
        .set("Authorization", `Bearer ${cashierA}`)
        .send({ items: [] })
        .expect(403);

      await request(http)
        .get(`/products/${fx.simple.id}/recipe`)
        .set("Authorization", `Bearer ${cashierA}`)
        .expect(200); // cashier has menu.view
    });

    it("sets a recipe (200g cheese per unit) and reads it back", async () => {
      const res = await request(http)
        .put(`/products/${fx.simple.id}/recipe`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ items: [{ ingredientId, unitId: units.gram.id, quantity: "200" }] })
        .expect(200);
      expect(res.body.items).toHaveLength(1);

      const get = await request(http)
        .get(`/products/${fx.simple.id}/recipe`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      expect(get.body.items[0].ingredient.id).toBe(ingredientId);
    });

    it("calculates product cost and gross margin from the recipe", async () => {
      // 200g * 0.05 SAR/g = 10.00 SAR cost. Selling price 12.00 -> margin 2.00 (16.67%).
      const res = await request(http)
        .get(`/products/${fx.simple.id}/recipe/cost`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      expect(res.body.hasRecipe).toBe(true);
      expect(res.body.sellingPrice).toBe("12"); // Prisma Decimal strips trailing zeros
      expect(res.body.cost).toBe("10.0000"); // costUnitsToSar() is a plain formatted string
      expect(res.body.grossMargin).toBe("2.00");
      expect(res.body.grossMarginPercent).toBe("16.67");
    });

    it("rejects duplicate ingredients within one recipe", async () => {
      await request(http)
        .put(`/products/${fx.simple.id}/recipe`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({
          items: [
            { ingredientId, unitId: units.gram.id, quantity: "100" },
            { ingredientId, unitId: units.gram.id, quantity: "50" },
          ],
        })
        .expect(400);
    });

    it("tenant B cannot read or set a recipe for tenant A's product", async () => {
      await request(http)
        .get(`/products/${fx.simple.id}/recipe`)
        .set("Authorization", `Bearer ${ownerB}`)
        .expect(404);
      await request(http)
        .put(`/products/${fx.simple.id}/recipe`)
        .set("Authorization", `Bearer ${ownerB}`)
        .send({ items: [] })
        .expect(404);
    });
  });

  describe("automatic stock deduction on order completion", () => {
    it("deducts recipe ingredients when the order is paid in full and completed", async () => {
      const before = await admin.stockLevel.findFirst({
        where: { tenantId: tenantAId, ingredient: { name: "جبن" } },
      });
      const beforeQty = Number(before?.quantity ?? 0);

      const order = await request(http)
        .post("/orders")
        .set("Authorization", `Bearer ${cashierA}`)
        .set("Idempotency-Key", key())
        .send({
          type: "walkin",
          branchId: branchA,
          confirm: true,
          items: [{ productId: fx.simple.id, quantity: 3 }], // recipe'd product: 3 * 12.00 = 36.00
        })
        .expect(201);
      expect(order.body.total).toBe("36");

      await request(http)
        .post(`/orders/${order.body.id}/payments`)
        .set("Authorization", `Bearer ${cashierA}`)
        .set("Idempotency-Key", key())
        .send({ method: "cash", amount: "36.00" })
        .expect(201);

      const completed = await admin.order.findUniqueOrThrow({ where: { id: order.body.id } });
      expect(completed.status).toBe("completed");

      // OrderItem cost snapshot: unitCost 10.00, lineCost 30.00 (3 * 10.00).
      const item = await admin.orderItem.findFirstOrThrow({ where: { orderId: order.body.id } });
      expect(item.unitCost?.toString()).toBe("10");
      expect(item.lineCost?.toString()).toBe("30");

      const movement = await waitUntil(() =>
        admin.stockMovement.findFirst({
          where: { tenantId: tenantAId, referenceType: "order", referenceId: order.body.id },
        }),
      );
      expect(movement.type).toBe("sale_deduction");
      expect(movement.quantity.toString()).toBe("-600"); // 3 * 200g

      const level = await admin.stockLevel.findFirstOrThrow({
        where: { tenantId: tenantAId, ingredient: { name: "جبن" } },
      });
      expect(Number(level.quantity)).toBe(beforeQty - 600);
    });

    it("does not create any movement for products without a recipe", async () => {
      const order = await request(http)
        .post("/orders")
        .set("Authorization", `Bearer ${cashierA}`)
        .set("Idempotency-Key", key())
        .send({
          type: "walkin",
          branchId: branchA,
          confirm: true,
          items: [{ productId: fx.withSize.id, quantity: 1, modifierIds: [fx.regular.id] }],
        })
        .expect(201);

      await request(http)
        .post(`/orders/${order.body.id}/payments`)
        .set("Authorization", `Bearer ${cashierA}`)
        .set("Idempotency-Key", key())
        .send({ method: "cash", amount: order.body.total })
        .expect(201);

      // Give the (no-op) listener a moment, then assert nothing was recorded.
      await new Promise((resolve) => setTimeout(resolve, 300));
      const movement = await admin.stockMovement.findFirst({
        where: { tenantId: tenantAId, referenceType: "order", referenceId: order.body.id },
      });
      expect(movement).toBeNull();
    });

    it("is idempotent when the same completion is processed twice", async () => {
      const order = await request(http)
        .post("/orders")
        .set("Authorization", `Bearer ${cashierA}`)
        .set("Idempotency-Key", key())
        .send({
          type: "walkin",
          branchId: branchA,
          confirm: true,
          items: [{ productId: fx.simple.id, quantity: 1 }],
        })
        .expect(201);

      await request(http)
        .post(`/orders/${order.body.id}/payments`)
        .set("Authorization", `Bearer ${cashierA}`)
        .set("Idempotency-Key", key())
        .send({ method: "cash", amount: order.body.total })
        .expect(201);

      await waitUntil(() =>
        admin.stockMovement.findFirst({
          where: { tenantId: tenantAId, referenceType: "order", referenceId: order.body.id },
        }),
      );
      const countAfterFirst = await admin.stockMovement.count({
        where: { tenantId: tenantAId, referenceType: "order", referenceId: order.body.id },
      });

      // Directly re-invoke the same deduction (simulates a duplicate domain event).
      const inventory = app.get(InventoryService);
      await inventory.deductForCompletedOrder(tenantAId, branchA, order.body.id, [
        { productId: fx.simple.id, quantity: 1 },
      ]);

      const countAfterSecond = await admin.stockMovement.count({
        where: { tenantId: tenantAId, referenceType: "order", referenceId: order.body.id },
      });
      expect(countAfterSecond).toBe(countAfterFirst);
    });
  });
});

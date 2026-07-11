import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../../src/app.module";
import { syncPermissionCatalog } from "../../src/modules/tenancy/tenant-provisioning";
import { createAdminClient, truncateAll } from "../helpers/db";
import { provisionTestTenant } from "../helpers/provision";

/**
 * Phase 2 e2e: category/product/modifier CRUD, branch availability,
 * modifier relationships, permission enforcement and cross-tenant isolation
 * through the real HTTP stack.
 */
describe("catalog (e2e)", () => {
  let app: INestApplication;
  let admin: PrismaClient;
  let http: ReturnType<INestApplication["getHttpServer"]>;

  let ownerA = ""; // tenant A owner token
  let ownerB = ""; // tenant B owner token
  let cashierA = ""; // tenant A cashier token (menu.view only)
  let branchA = "";

  let categoryId = "";
  let productId = "";
  let groupId = "";
  let modifierId = "";

  async function login(email: string, password = "Test-12345"): Promise<string> {
    const res = await request(http)
      .post("/auth/login")
      .send({ email, password })
      .expect(200);
    return res.body.tokens.accessToken;
  }

  beforeAll(async () => {
    admin = createAdminClient();
    await truncateAll(admin);
    await syncPermissionCatalog(admin);

    const tenantA = await provisionTestTenant(admin, {
      name: "مطعم ألف",
      slug: "cat-a",
      ownerEmail: "owner@cat-a.test",
    });
    branchA = tenantA.branchId!;
    const tenantB = await provisionTestTenant(admin, {
      name: "مطعم باء",
      slug: "cat-b",
      ownerEmail: "owner@cat-b.test",
    });

    // Cashier in tenant A: has menu.view but not menu.manage.
    const { hashPassword } = await import("../../src/modules/identity/password");
    const cashier = await admin.user.create({
      data: {
        email: "cashier@cat-a.test",
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

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    http = app.getHttpServer();

    ownerA = await login("owner@cat-a.test");
    ownerB = await login("owner@cat-b.test");
    cashierA = await login("cashier@cat-a.test");
    void tenantB;
  });

  afterAll(async () => {
    await app.close();
    await admin.$disconnect();
  });

  describe("categories CRUD", () => {
    it("creates a category with bilingual names", async () => {
      const res = await request(http)
        .post("/catalog/categories")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({
          name: "المشويات",
          nameEn: "Grills",
          description: "أطباق مشوية على الفحم",
          sortOrder: 1,
        })
        .expect(201);
      categoryId = res.body.id;
      expect(res.body.name).toBe("المشويات");
      expect(res.body.isActive).toBe(true);

      const audit = await admin.auditLog.findMany({ where: { action: "category.created" } });
      expect(audit).toHaveLength(1);
    });

    it("updates and deactivates a category", async () => {
      const res = await request(http)
        .patch(`/catalog/categories/${categoryId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ nameEn: "Charcoal Grills", isActive: false })
        .expect(200);
      expect(res.body.nameEn).toBe("Charcoal Grills");
      expect(res.body.isActive).toBe(false);

      await request(http)
        .patch(`/catalog/categories/${categoryId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ isActive: true })
        .expect(200);
    });

    it("rejects invalid payloads", async () => {
      await request(http)
        .post("/catalog/categories")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ name: "", sortOrder: -1 })
        .expect(400);
      await request(http)
        .post("/catalog/categories")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ name: "x", unknownField: true })
        .expect(400);
    });
  });

  describe("products CRUD", () => {
    it("creates a product with price as decimal string", async () => {
      const res = await request(http)
        .post("/catalog/products")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({
          name: "شيش طاووق",
          nameEn: "Shish Tawook",
          sku: "GRL-001",
          categoryId,
          basePrice: "32.50",
        })
        .expect(201);
      productId = res.body.id;
      expect(res.body.basePrice).toBe("32.5");
      expect(res.body.category.name).toBe("المشويات");
    });

    it("rejects float-ish and malformed prices", async () => {
      for (const basePrice of ["32.505", "abc", "-5", ""]) {
        await request(http)
          .post("/catalog/products")
          .set("Authorization", `Bearer ${ownerA}`)
          .send({ name: "x", categoryId, basePrice })
          .expect(400);
      }
    });

    it("enforces SKU uniqueness within the tenant", async () => {
      await request(http)
        .post("/catalog/products")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ name: "منتج آخر", categoryId, basePrice: "10.00", sku: "GRL-001" })
        .expect(409);
    });

    it("allows the same SKU in a different tenant", async () => {
      const cat = await request(http)
        .post("/catalog/categories")
        .set("Authorization", `Bearer ${ownerB}`)
        .send({ name: "قسم باء" })
        .expect(201);
      await request(http)
        .post("/catalog/products")
        .set("Authorization", `Bearer ${ownerB}`)
        .send({ name: "منتج باء", categoryId: cat.body.id, basePrice: "9.00", sku: "GRL-001" })
        .expect(201);
    });

    it("updates a product", async () => {
      const res = await request(http)
        .patch(`/catalog/products/${productId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ basePrice: "35.00", taxRate: "15.00" })
        .expect(200);
      expect(res.body.basePrice).toBe("35");
      expect(res.body.taxRate).toBe("15");
    });

    it("blocks deleting a category that still has products", async () => {
      await request(http)
        .delete(`/catalog/categories/${categoryId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(409);
    });
  });

  describe("modifier relationships", () => {
    it("creates a group with selection rules and modifiers", async () => {
      const group = await request(http)
        .post("/catalog/modifier-groups")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ name: "الحجم", nameEn: "Size", isRequired: true, minSelect: 1, maxSelect: 1 })
        .expect(201);
      groupId = group.body.id;
      expect(group.body.minSelect).toBe(1);

      const modifier = await request(http)
        .post(`/catalog/modifier-groups/${groupId}/modifiers`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ name: "كبير", nameEn: "Large", priceAdjustment: "5.00" })
        .expect(201);
      modifierId = modifier.body.id;
      expect(modifier.body.priceAdjustment).toBe("5");

      await request(http)
        .post(`/catalog/modifier-groups/${groupId}/modifiers`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ name: "صغير", nameEn: "Small", priceAdjustment: "0" })
        .expect(201);
    });

    it("rejects inconsistent selection rules", async () => {
      await request(http)
        .post("/catalog/modifier-groups")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ name: "خاطئ", minSelect: 3, maxSelect: 2 })
        .expect(400);
    });

    it("attaches groups to a product and returns the full menu tree", async () => {
      await request(http)
        .put(`/catalog/products/${productId}/modifier-groups`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ groups: [{ modifierGroupId: groupId, sortOrder: 0 }] })
        .expect(200);

      const res = await request(http)
        .get(`/catalog/products/${productId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      expect(res.body.modifierGroups).toHaveLength(1);
      const attached = res.body.modifierGroups[0].group;
      expect(attached.name).toBe("الحجم");
      expect(attached.modifiers).toHaveLength(2);
      expect(attached.modifiers.map((m: { name: string }) => m.name)).toEqual(
        expect.arrayContaining(["كبير", "صغير"]),
      );
    });

    it("blocks deleting a group attached to a product, allows after detaching", async () => {
      await request(http)
        .delete(`/catalog/modifier-groups/${groupId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(409);

      const extra = await request(http)
        .post("/catalog/modifier-groups")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ name: "مجموعة مؤقتة" })
        .expect(201);
      await request(http)
        .delete(`/catalog/modifier-groups/${extra.body.id}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
    });

    it("updates a modifier", async () => {
      const res = await request(http)
        .patch(`/catalog/modifiers/${modifierId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ priceAdjustment: "6.50" })
        .expect(200);
      expect(res.body.priceAdjustment).toBe("6.5");
    });
  });

  describe("branch availability", () => {
    it("sets availability with a price override", async () => {
      const res = await request(http)
        .put(`/catalog/products/${productId}/branch-settings/${branchA}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ isAvailable: true, priceOverride: "30.00" })
        .expect(200);
      expect(res.body.priceOverride).toBe("30");

      const product = await request(http)
        .get(`/catalog/products/${productId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      expect(product.body.branchSettings).toHaveLength(1);
      expect(product.body.branchSettings[0].isAvailable).toBe(true);
    });

    it("upserts: marking unavailable clears the override when omitted", async () => {
      const res = await request(http)
        .put(`/catalog/products/${productId}/branch-settings/${branchA}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ isAvailable: false })
        .expect(200);
      expect(res.body.isAvailable).toBe(false);
      expect(res.body.priceOverride).toBeNull();
    });

    it("rejects an unknown branch", async () => {
      await request(http)
        .put(
          `/catalog/products/${productId}/branch-settings/00000000-0000-4000-8000-000000000000`,
        )
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ isAvailable: true })
        .expect(404);
    });
  });

  describe("tenant isolation via the API", () => {
    it("tenant B cannot see or touch tenant A's catalog", async () => {
      const list = await request(http)
        .get("/catalog/categories")
        .set("Authorization", `Bearer ${ownerB}`)
        .expect(200);
      expect(
        list.body.find((c: { id: string }) => c.id === categoryId),
      ).toBeUndefined();

      await request(http)
        .get(`/catalog/products/${productId}`)
        .set("Authorization", `Bearer ${ownerB}`)
        .expect(404);
      await request(http)
        .patch(`/catalog/products/${productId}`)
        .set("Authorization", `Bearer ${ownerB}`)
        .send({ basePrice: "1.00" })
        .expect(404);
      await request(http)
        .delete(`/catalog/categories/${categoryId}`)
        .set("Authorization", `Bearer ${ownerB}`)
        .expect(404);

      // Tenant B cannot attach tenant A's modifier group to its own product either.
      const bProducts = await request(http)
        .get("/catalog/products")
        .set("Authorization", `Bearer ${ownerB}`)
        .expect(200);
      await request(http)
        .put(`/catalog/products/${bProducts.body[0].id}/modifier-groups`)
        .set("Authorization", `Bearer ${ownerB}`)
        .send({ groups: [{ modifierGroupId: groupId }] })
        .expect(404);
    });

    it("tenant A's data is intact after tenant B's attempts", async () => {
      const product = await admin.product.findUniqueOrThrow({ where: { id: productId } });
      expect(product.basePrice.toString()).toBe("35");
      expect(product.deletedAt).toBeNull();
    });
  });

  describe("permission enforcement", () => {
    it("cashier (menu.view) can read but not write", async () => {
      await request(http)
        .get("/catalog/products")
        .set("Authorization", `Bearer ${cashierA}`)
        .expect(200);
      await request(http)
        .post("/catalog/categories")
        .set("Authorization", `Bearer ${cashierA}`)
        .send({ name: "ممنوع" })
        .expect(403);
      await request(http)
        .delete(`/catalog/products/${productId}`)
        .set("Authorization", `Bearer ${cashierA}`)
        .expect(403);
    });

    it("anonymous requests are rejected", async () => {
      await request(http).get("/catalog/categories").expect(401);
      await request(http).post("/catalog/products").send({}).expect(401);
    });
  });

  describe("soft delete", () => {
    it("soft-deleted products disappear from lists but stay in the DB", async () => {
      const p = await request(http)
        .post("/catalog/products")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ name: "منتج للحذف", categoryId, basePrice: "5.00" })
        .expect(201);

      await request(http)
        .delete(`/catalog/products/${p.body.id}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);

      await request(http)
        .get(`/catalog/products/${p.body.id}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(404);

      const row = await admin.product.findUniqueOrThrow({ where: { id: p.body.id } });
      expect(row.deletedAt).not.toBeNull();
    });
  });
});

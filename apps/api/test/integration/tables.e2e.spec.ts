import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../../src/app.module";
import { syncPermissionCatalog } from "../../src/modules/tenancy/tenant-provisioning";
import { createAdminClient, truncateAll } from "../helpers/db";
import { provisionTestTenant } from "../helpers/provision";

/**
 * Phase 3 e2e: floors & tables CRUD, QR uniqueness/regeneration, PNG/PDF
 * generation, table sessions, permission enforcement and tenant isolation.
 */
describe("tables & QR (e2e)", () => {
  let app: INestApplication;
  let admin: PrismaClient;
  let http: ReturnType<INestApplication["getHttpServer"]>;

  let ownerA = "";
  let ownerB = "";
  let waiterA = ""; // tables.view only
  let branchA = "";

  let floorId = "";
  let tableId = "";
  let firstToken = "";

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

    const tenantA = await provisionTestTenant(admin, {
      name: "مطعم ألف",
      slug: "tbl-a",
      ownerEmail: "owner@tbl-a.test",
    });
    branchA = tenantA.branchId!;
    await provisionTestTenant(admin, {
      name: "مطعم باء",
      slug: "tbl-b",
      ownerEmail: "owner@tbl-b.test",
    });

    const { hashPassword } = await import("../../src/modules/identity/password");
    const waiter = await admin.user.create({
      data: {
        email: "waiter@tbl-a.test",
        name: "Waiter A",
        passwordHash: await hashPassword("Test-12345"),
        emailVerifiedAt: new Date(),
      },
    });
    await admin.userRole.create({
      data: {
        tenantId: tenantA.tenantId,
        userId: waiter.id,
        roleId: tenantA.roleIdsByKey.waiter,
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

    ownerA = await login("owner@tbl-a.test");
    ownerB = await login("owner@tbl-b.test");
    waiterA = await login("waiter@tbl-a.test");
  });

  afterAll(async () => {
    await app.close();
    await admin.$disconnect();
  });

  describe("floors CRUD", () => {
    it("creates a floor bound to a branch", async () => {
      const res = await request(http)
        .post("/floors")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ branchId: branchA, name: "الصالة الرئيسية", nameEn: "Main Hall" })
        .expect(201);
      floorId = res.body.id;
      expect(res.body.isActive).toBe(true);
    });

    it("updates a floor", async () => {
      const res = await request(http)
        .patch(`/floors/${floorId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ nameEn: "Grand Hall", sortOrder: 2 })
        .expect(200);
      expect(res.body.nameEn).toBe("Grand Hall");
    });

    it("rejects a floor for an unknown branch", async () => {
      await request(http)
        .post("/floors")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ branchId: "00000000-0000-4000-8000-000000000000", name: "x" })
        .expect(404);
    });
  });

  describe("tables CRUD + QR uniqueness", () => {
    it("creates a table with a generated QR token", async () => {
      const res = await request(http)
        .post("/tables")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ floorId, number: "A1", capacity: 4 })
        .expect(201);
      tableId = res.body.id;
      firstToken = res.body.qrToken;
      expect(firstToken).toMatch(/^[A-Za-z0-9_-]{16}$/);
      expect(firstToken).not.toBe(tableId); // never the database id
      expect(res.body.status).toBe("available");
    });

    it("QR tokens are unique across tables", async () => {
      const tokens = new Set([firstToken]);
      for (const number of ["A2", "A3", "A4"]) {
        const res = await request(http)
          .post("/tables")
          .set("Authorization", `Bearer ${ownerA}`)
          .send({ floorId, number })
          .expect(201);
        expect(tokens.has(res.body.qrToken)).toBe(false);
        tokens.add(res.body.qrToken);
      }
    });

    it("rejects duplicate table numbers within a branch", async () => {
      await request(http)
        .post("/tables")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ floorId, number: "A1" })
        .expect(409);
    });

    it("updates a table (number, capacity, manual status)", async () => {
      const res = await request(http)
        .patch(`/tables/${tableId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ capacity: 6, status: "reserved" })
        .expect(200);
      expect(res.body.capacity).toBe(6);
      expect(res.body.status).toBe("reserved");

      await request(http)
        .patch(`/tables/${tableId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ status: "available" })
        .expect(200);
    });

    it("soft delete frees the number for reuse", async () => {
      const extra = await request(http)
        .post("/tables")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ floorId, number: "TMP" })
        .expect(201);
      await request(http)
        .delete(`/tables/${extra.body.id}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);

      const row = await admin.table.findUniqueOrThrow({ where: { id: extra.body.id } });
      expect(row.deletedAt).not.toBeNull();

      // Number is reusable after soft delete (partial unique index).
      await request(http)
        .post("/tables")
        .set("Authorization", `Bearer ${ownerA}`)
        .send({ floorId, number: "TMP" })
        .expect(201);
    });

    it("blocks deleting a floor that still has tables", async () => {
      await request(http)
        .delete(`/floors/${floorId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(409);
    });
  });

  describe("QR generation & regeneration", () => {
    it("builds the public URL without exposing database ids", async () => {
      const res = await request(http)
        .get(`/tables/${tableId}/qr-url`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      expect(res.body.url).toContain(`/menu/tbl-a/table/${firstToken}`);
      expect(res.body.url).not.toContain(tableId);
      expect(res.body.url).not.toContain(branchA);
    });

    it("serves a PNG QR image", async () => {
      const res = await request(http)
        .get(`/tables/${tableId}/qr.png`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      expect(res.headers["content-type"]).toContain("image/png");
      // PNG magic bytes
      expect(res.body.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    });

    it("serves a PDF print sheet for the branch", async () => {
      const res = await request(http)
        .get(`/tables/qr-sheet.pdf?branchId=${branchA}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .buffer()
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect((res.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
    });

    it("regenerates the token and disables the old QR", async () => {
      const res = await request(http)
        .post(`/tables/${tableId}/regenerate-qr`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      const newToken = res.body.qrToken;
      expect(newToken).not.toBe(firstToken);

      // Old token no longer resolves; the new one does.
      const byOldToken = await admin.table.findUnique({ where: { qrToken: firstToken } });
      expect(byOldToken).toBeNull();
      const byNewToken = await admin.table.findUnique({ where: { qrToken: newToken } });
      expect(byNewToken?.id).toBe(tableId);

      // Audit trail keeps the replaced token.
      const audit = await admin.auditLog.findFirst({
        where: { action: "table.qr_regenerated", entityId: tableId },
      });
      expect(audit?.meta).toMatchObject({ previousToken: firstToken });
      firstToken = newToken;
    });
  });

  describe("table sessions (foundation)", () => {
    it("opens a session and marks the table occupied", async () => {
      const res = await request(http)
        .post(`/tables/${tableId}/sessions/open`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({})
        .expect(200);
      expect(res.body.closedAt).toBeNull();

      const table = await admin.table.findUniqueOrThrow({ where: { id: tableId } });
      expect(table.status).toBe("occupied");
    });

    it("rejects a second open session on the same table", async () => {
      await request(http)
        .post(`/tables/${tableId}/sessions/open`)
        .set("Authorization", `Bearer ${ownerA}`)
        .send({})
        .expect(409);
    });

    it("blocks deleting a table with an open session", async () => {
      await request(http)
        .delete(`/tables/${tableId}`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(409);
    });

    it("closes the session and frees the table", async () => {
      const res = await request(http)
        .post(`/tables/${tableId}/sessions/close`)
        .set("Authorization", `Bearer ${ownerA}`)
        .expect(200);
      expect(res.body.closedAt).not.toBeNull();

      const table = await admin.table.findUniqueOrThrow({ where: { id: tableId } });
      expect(table.status).toBe("available");
    });
  });

  describe("permissions & tenant isolation", () => {
    it("waiter (tables.view) can list but not create/regenerate", async () => {
      await request(http)
        .get("/tables")
        .set("Authorization", `Bearer ${waiterA}`)
        .expect(200);
      await request(http)
        .post("/tables")
        .set("Authorization", `Bearer ${waiterA}`)
        .send({ floorId, number: "W1" })
        .expect(403);
      await request(http)
        .post(`/tables/${tableId}/regenerate-qr`)
        .set("Authorization", `Bearer ${waiterA}`)
        .expect(403);
    });

    it("anonymous requests are rejected", async () => {
      await request(http).get("/tables").expect(401);
      await request(http).get(`/tables/${tableId}/qr.png`).expect(401);
    });

    it("tenant B cannot see or touch tenant A's floors/tables", async () => {
      const floors = await request(http)
        .get("/floors")
        .set("Authorization", `Bearer ${ownerB}`)
        .expect(200);
      expect(floors.body.find((f: { id: string }) => f.id === floorId)).toBeUndefined();

      await request(http)
        .patch(`/tables/${tableId}`)
        .set("Authorization", `Bearer ${ownerB}`)
        .send({ number: "HIJACK" })
        .expect(404);
      await request(http)
        .post(`/tables/${tableId}/regenerate-qr`)
        .set("Authorization", `Bearer ${ownerB}`)
        .expect(404);
      await request(http)
        .get(`/tables/${tableId}/qr.png`)
        .set("Authorization", `Bearer ${ownerB}`)
        .expect(404);

      const table = await admin.table.findUniqueOrThrow({ where: { id: tableId } });
      expect(table.number).not.toBe("HIJACK");
    });
  });
});

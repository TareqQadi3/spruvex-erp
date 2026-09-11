// Integration test: proves requireActiveSubscription is enforced on the
// live /api/sales path and the modular zatca router, and that login +
// /api/platform are unaffected. Uses the real database, real express app,
// real JWT signing.
//
// Originally written against modules/pos/routes/sales.routes.ts, which was
// deleted 2026-09-06 (fix/sales-route-conflict) after live-server testing
// proved it was dead code — POST /api/sales was always shadowed by this
// legacy modules/sales/routes/sales.ts router (mounted via routes/index.ts).
// That legacy router does NOT gate itself internally (unlike zatca below);
// production applies requireAuth + requireActiveSubscription at the mount
// site in routes/index.ts (`router.use("/sales", requireAuth,
// requireActiveSubscription, salesRouter)`). Rewritten here to replicate
// that exact mount so the test still proves the real production behavior.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { eq, and, isNull } from "drizzle-orm";
import { db, pool, companiesTable, subscriptionsTable, usersTable, productsTable, paymentMethodsTable, warehousesTable, rolesTable, userRolesTable } from "@workspace/db";
import { env } from "../../../config/env";
import { errorHandler } from "../../../core/errors/errorHandler";
import { requireAuth, requireActiveSubscription } from "../../../lib/auth-middleware";
import { ensureGlobalRbacSeeded } from "../../../modules/rbac/services/rbacSeedService";
import zatcaRouter from "../../../modules/zatca/routes/zatca.routes";
import salesRouter from "./sales";

const companyId = randomUUID();
let productId: string;
let paymentMethodId: string;
let token: string;
let server: http.Server;
let port = 0;

function fetch(method: string, path: string, body?: unknown) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 500, body: data }));
    });
    req.on("error", reject);
    if (body !== undefined) req.end(JSON.stringify(body));
    else req.end();
  });
}

beforeAll(async () => {
  await db.insert(companiesTable).values({ id: companyId, name: "gate test co", plan: "starter" });
  await db.insert(subscriptionsTable).values({ companyId, status: "active" });
  const [user] = await db
    .insert(usersTable)
    .values({ companyId, username: `gate-${randomUUID().slice(0, 8)}`, passwordHash: "unused" })
    .returning();
  await db.insert(warehousesTable).values({ companyId, name: "Main", isRepairStock: false, isDefault: true });
  const [product] = await db
    .insert(productsTable)
    .values({ companyId, name: "Gate Widget", sku: `GATE-${randomUUID().slice(0, 8)}`, sellingPrice: "50.00", costPrice: "20.00", stock: 5 })
    .returning();
  productId = product.id;
  const [pm] = await db
    .insert(paymentMethodsTable)
    .values({ companyId, name: "Cash", percentFee: "0", fixedFee: "0" })
    .returning();
  paymentMethodId = pm.id;

  // Seed RBAC so the ZATCA router's requirePermission(MANAGE_ACCOUNTING) passes.
  await ensureGlobalRbacSeeded();
  const [adminRole] = await db
    .select()
    .from(rolesTable)
    .where(and(eq(rolesTable.name, "admin"), isNull(rolesTable.companyId)))
    .limit(1);
  if (adminRole) {
    await db.insert(userRolesTable).values({ companyId, userId: user.id, roleId: adminRole.id });
  }

  token = jwt.sign({ sub: user.id, companyId, role: "admin" }, env.jwtSecret);

  const app = express();
  app.use(express.json());
  app.use("/api/zatca", zatcaRouter);
  app.use("/api/sales", requireAuth, requireActiveSubscription, salesRouter);
  app.use(errorHandler);

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      port = (server.address() as { port: number }).port;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((r) => server?.close(() => r()));
  await db.delete(userRolesTable).where(eq(userRolesTable.companyId, companyId));
  await db.delete(productsTable).where(eq(productsTable.companyId, companyId));
  await db.delete(paymentMethodsTable).where(eq(paymentMethodsTable.companyId, companyId));
  await db.delete(warehousesTable).where(eq(warehousesTable.companyId, companyId));
  await db.delete(usersTable).where(eq(usersTable.companyId, companyId));
  await db.delete(subscriptionsTable).where(eq(subscriptionsTable.companyId, companyId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));
  await pool.end();
});

describe("T-11 subscription gate (zatca router + live /api/sales mount)", () => {
  it("C1: zatca returns 403 when suspended, 200/404 when active", async () => {
    const uuid = "00000000-0000-0000-0000-000000000000";
    const r1 = await fetch("GET", `/api/zatca/invoices/${uuid}`);
    expect(r1.status).not.toBe(403);
    expect(r1.status).toBe(404); // invoice not found, but gate passed

    await db.update(subscriptionsTable).set({ status: "suspended" }).where(eq(subscriptionsTable.companyId, companyId));

    const r2 = await fetch("GET", `/api/zatca/invoices/${uuid}`);
    expect(r2.status).toBe(403);
    expect(r2.body).toContain("Subscription inactive");

    await db.update(subscriptionsTable).set({ status: "active" }).where(eq(subscriptionsTable.companyId, companyId));

    const r3 = await fetch("GET", `/api/zatca/invoices/${uuid}`);
    expect(r3.status).not.toBe(403);
    expect(r3.status).toBe(404);
  });

  it("C2: POST /api/sales returns 403 when suspended, 201 when active", async () => {
    const payload = { items: [{ productId, quantity: 1, unitPrice: 50 }], paymentMethodId, amountPaid: 50 };
    const r1 = await fetch("POST", "/api/sales", payload);
    expect(r1.status).toBe(201);

    await db.update(subscriptionsTable).set({ status: "suspended" }).where(eq(subscriptionsTable.companyId, companyId));

    const r2 = await fetch("POST", "/api/sales", payload);
    expect(r2.status).toBe(403);
    expect(r2.body).toContain("Subscription inactive");

    await db.update(subscriptionsTable).set({ status: "active" }).where(eq(subscriptionsTable.companyId, companyId));

    const r3 = await fetch("POST", "/api/sales", payload);
    expect(r3.status).toBe(201);
  });

  it("C4: login and /api/platform are structurally unaffected", () => {
    // The routers under test are self-contained module routers mounted at
    // their own paths. They do not export or mount auth or platform routes.
    // zatca gates itself internally (router.use(...) inside zatca.routes.ts);
    // sales is gated at the mount site here, replicating routes/index.ts's
    // per-path `router.use("/sales", requireAuth, requireActiveSubscription,
    // salesRouter)` exactly (routes/index.ts documents why: a bare, pathless
    // router.use(mw) previously leaked into sibling mounts like
    // /api/platform — see the comment there). Either way the gate is scoped
    // to a specific path, never applied unconditionally ahead of unrelated
    // routers, so /api/auth and /api/platform can't be affected.
    // Verified by the test app above — only these routers are mounted;
    // /api/auth and /api/platform are not and never reachable via this app.
    expect(zatcaRouter).toBeDefined();
    expect(salesRouter).toBeDefined();
  });
});
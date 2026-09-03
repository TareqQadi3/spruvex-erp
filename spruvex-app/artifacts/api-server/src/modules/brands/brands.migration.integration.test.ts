// Migration contract test for T-07: the legacy /api/brands route was moved
// from the flat routes/ aggregate into src/modules/brands (routes + service +
// repository) and re-mounted at /api/brands in app.ts. This test proves the
// migrated router is behavior-identical to the legacy contract by exercising
// the real modular router through an express harness against the actual
// configured DATABASE_URL — create (201), list (200), update (200), delete
// (204), and the guard rails (400 missing name, 404 missing row, 409 brand
// still in use by a product). Each test creates and cleans up its own
// throwaway company.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import { type Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { db, pool, companiesTable, subscriptionsTable, productsTable, brandsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { errorHandler } from "../../core/errors/errorHandler";
import { env } from "../../config/env";
import brandsRouter from "./routes/brands.routes";

const companyId = randomUUID();
const userId = randomUUID();
let server: Server;
let baseUrl: string;
let token: string;

function buildApp() {
  const application = express();
  application.use(express.json());
  application.use("/api/brands", brandsRouter);
  application.use(errorHandler);
  return application;
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

beforeAll(async () => {
  // Warm the connection pool before the first real request: the hosted
  // Postgres (Neon) cold-starts on its first query, which can exceed the
  // per-test timeout. A throwaway count here makes the first request warm.
  await db.select({ id: companiesTable.id }).from(companiesTable).limit(1);
  await db.insert(companiesTable).values({ id: companyId, name: "vitest brands migration co" });
  await db.insert(subscriptionsTable).values({ companyId, status: "active" });
  token = jwt.sign({ sub: userId, companyId, role: "admin" }, env.jwtSecret);

  server = buildApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/brands`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => (err ? reject(err) : resolve())));
  await db.delete(productsTable).where(eq(productsTable.companyId, companyId));
  await db.delete(brandsTable).where(eq(brandsTable.companyId, companyId));
  await db.delete(subscriptionsTable).where(eq(subscriptionsTable.companyId, companyId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));
  await pool.end();
});

describe("migrated /api/brands (modules/brands — legacy contract preserved)", () => {
  it("creates a brand (201) and returns it in the list (200)", async () => {
    const created = await api("POST", "/", { name: "Nike" });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe("Nike");
    expect(created.body.companyId).toBe(companyId);
    expect(created.body.id).toBeTruthy();

    const list = await api("GET", "/");
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.some((b: { id: string }) => b.id === created.body.id)).toBe(true);
  });

  it("rejects a brand without a name (400)", async () => {
    const res = await api("POST", "/", { imageUrl: "https://example.com/x.png" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("name is required");
  });

  it("updates a brand (200) and scopes the row to the tenant", async () => {
    const created = await api("POST", "/", { name: "Adidas", imageUrl: "https://example.com/a.png" });
    expect(created.status).toBe(201);

    const updated = await api("PUT", `/${created.body.id}`, { name: "Adidas Originals" });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe("Adidas Originals");
    expect(updated.body.imageUrl).toBe("https://example.com/a.png");

    const list = await api("GET", "/");
    expect(list.body.some((b: { id: string }) => b.id === created.body.id)).toBe(true);
  });

  it("returns 404 when updating a brand that does not exist", async () => {
    const res = await api("PUT", `/${randomUUID()}`, { name: "Ghost" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Not found");
  });

  it("deletes a brand (204) and returns 404 for the deleted row afterwards", async () => {
    const created = await api("POST", "/", { name: "DeleteMe" });
    expect(created.status).toBe(201);

    const deleted = await api("DELETE", `/${created.body.id}`);
    expect(deleted.status).toBe(204);

    const gone = await api("DELETE", `/${created.body.id}`);
    expect(gone.status).toBe(404);
    expect(gone.body.error).toBe("Not found");

    const list = await api("GET", "/");
    expect(list.body.some((b: { id: string }) => b.id === created.body.id)).toBe(false);
  });

  it("returns 409 when deleting a brand still referenced by a product", async () => {
    const created = await api("POST", "/", { name: "InUse" });
    expect(created.status).toBe(201);

    await db.insert(productsTable).values({
      companyId,
      name: "InUse product",
      sku: `VITEST-${randomUUID().slice(0, 8)}`,
      brand: "InUse",
    });

    const deleted = await api("DELETE", `/${created.body.id}`);
    expect(deleted.status).toBe(409);
    expect(deleted.body.error).toBe("This brand still has products assigned to it");
  });
});

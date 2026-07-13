import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import request from "supertest";

import { AppModule } from "../../src/app.module";
import { syncPermissionCatalog } from "../../src/modules/tenancy/tenant-provisioning";
import { createOrderingFixtures } from "../helpers/catalog-fixtures";
import { createAdminClient, truncateAll } from "../helpers/db";
import { provisionTestTenant } from "../helpers/provision";

type Fixtures = Awaited<ReturnType<typeof createOrderingFixtures>>;

function waitFor<T>(socket: Socket, event: string, timeoutMs = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}"`)),
      timeoutMs,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function subscribe(
  socket: Socket,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; room?: string; error?: string }> {
  return socket.emitWithAck("subscribe", payload);
}

describe("realtime (e2e)", () => {
  let app: INestApplication;
  let admin: PrismaClient;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let baseUrl = "";

  let ownerA = "";
  let kitchenA = "";
  let ownerB = "";
  let branchA = "";
  let branchB = "";
  let fx: Fixtures;
  const sockets: Socket[] = [];

  function connect(token?: string): Socket {
    const socket = io(baseUrl, {
      transports: ["websocket"],
      auth: token ? { token } : {},
      reconnection: false,
    });
    sockets.push(socket);
    return socket;
  }

  async function login(email: string): Promise<string> {
    const res = await request(http)
      .post("/auth/login")
      .send({ email, password: "Test-12345" })
      .expect(200);
    return res.body.tokens.accessToken;
  }

  function createOrder(token: string, body: Record<string, unknown>) {
    return request(http)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", randomUUID())
      .send(body);
  }

  beforeAll(async () => {
    admin = createAdminClient();
    await truncateAll(admin);
    await syncPermissionCatalog(admin);

    const tenantA = await provisionTestTenant(admin, {
      name: "مطعم ألف",
      slug: "rt-a",
      ownerEmail: "owner@rt-a.test",
    });
    branchA = tenantA.branchId!;
    const tenantB = await provisionTestTenant(admin, {
      name: "مطعم باء",
      slug: "rt-b",
      ownerEmail: "owner@rt-b.test",
    });
    branchB = tenantB.branchId!;

    const { hashPassword } = await import("../../src/modules/identity/password");
    const kitchen = await admin.user.create({
      data: {
        email: "kitchen@rt-a.test",
        name: "Kitchen A",
        passwordHash: await hashPassword("Test-12345"),
        emailVerifiedAt: new Date(),
      },
    });
    await admin.userRole.create({
      data: {
        tenantId: tenantA.tenantId,
        userId: kitchen.id,
        roleId: tenantA.roleIdsByKey.kitchen,
        branchId: branchA,
      },
    });

    fx = await createOrderingFixtures(admin, tenantA.tenantId, branchA);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.listen(0);
    http = app.getHttpServer();
    const address = http.address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;

    ownerA = await login("owner@rt-a.test");
    ownerB = await login("owner@rt-b.test");
    kitchenA = await login("kitchen@rt-a.test");
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.disconnect();
    }
    await app.close();
    await admin.$disconnect();
  });

  it("treats tokenless/invalid-token sockets as guests: staff channels denied", async () => {
    const guest = connect(); // no token
    await waitFor(guest, "connect");
    expect((await subscribe(guest, { channel: "orders" })).error).toBe("unauthorized");
    expect(
      (await subscribe(guest, { channel: "kitchen", branchId: branchA })).error,
    ).toBe("unauthorized");

    const bad = connect("not-a-jwt");
    await waitFor(bad, "connect");
    expect((await subscribe(bad, { channel: "orders" })).error).toBe("unauthorized");
  });

  it("guest sockets follow one order via its UUID and receive status updates", async () => {
    const created = await createOrder(ownerA, {
      type: "walkin",
      branchId: branchA,
      confirm: true,
      items: [{ productId: fx.simple.id, quantity: 1 }],
    }).expect(201);

    const guest = connect(); // customer app: no JWT
    await waitFor(guest, "connect");

    const sub = await subscribe(guest, { channel: "order", orderId: created.body.id });
    expect(sub.ok).toBe(true);
    expect(sub.room).toBe(`order:${created.body.id}`);

    const statusEvent = waitFor<{ id: string; status: string; orderNumber: number }>(
      guest,
      "order.status",
    );
    await request(http)
      .post(`/orders/${created.body.id}/status`)
      .set("Authorization", `Bearer ${ownerA}`)
      .send({ status: "preparing" })
      .expect(200);

    const event = await statusEvent;
    expect(event.id).toBe(created.body.id);
    expect(event.status).toBe("preparing");
    // Trimmed payload: no staff/actor internals.
    expect(event).not.toHaveProperty("placedBy");
    expect(event).not.toHaveProperty("statusHistory");

    // Unknown order id -> rejected.
    const bogus = await subscribe(guest, {
      channel: "order",
      orderId: "00000000-0000-4000-8000-000000000000",
    });
    expect(bogus.ok).toBe(false);
  });

  it("authorizes subscriptions by permission", async () => {
    const kitchenSocket = connect(kitchenA);
    await waitFor(kitchenSocket, "connect");

    // kitchen.view ✓
    const kitchenSub = await subscribe(kitchenSocket, { channel: "kitchen", branchId: branchA });
    expect(kitchenSub.ok).toBe(true);
    expect(kitchenSub.room).toBe(`branch:${branchA}:kitchen`);

    // Owner subscribing to orders ✓; kitchen has orders.view too, so use a
    // negative check instead: kitchen subscribing to a foreign branch fails.
    const foreign = await subscribe(kitchenSocket, { channel: "kitchen", branchId: branchB });
    expect(foreign.ok).toBe(false);
    expect(foreign.error).toBe("branch not found");

    const missingBranch = await subscribe(kitchenSocket, { channel: "kitchen" });
    expect(missingBranch.ok).toBe(false);
  });

  it("denies channels the role lacks", async () => {
    // Tenant B owner has kitchen.view but only inside tenant B; branchA is invisible.
    const socketB = connect(ownerB);
    await waitFor(socketB, "connect");
    const res = await subscribe(socketB, { channel: "kitchen", branchId: branchA });
    expect(res.ok).toBe(false);
  });

  it("pushes order.created to the tenant orders room and the branch kitchen room", async () => {
    const posSocket = connect(ownerA);
    const kitchenSocket = connect(kitchenA);
    await waitFor(posSocket, "connect");
    await waitFor(kitchenSocket, "connect");
    expect((await subscribe(posSocket, { channel: "orders" })).ok).toBe(true);
    expect(
      (await subscribe(kitchenSocket, { channel: "kitchen", branchId: branchA })).ok,
    ).toBe(true);

    const posEvent = waitFor<{ id: string; orderNumber: number }>(posSocket, "order.created");
    const kdsEvent = waitFor<{ id: string; items: unknown[] }>(kitchenSocket, "order.created");

    const created = await createOrder(ownerA, {
      type: "walkin",
      branchId: branchA,
      items: [{ productId: fx.simple.id, quantity: 1 }],
    }).expect(201);

    const [pos, kds] = await Promise.all([posEvent, kdsEvent]);
    expect(pos.id).toBe(created.body.id);
    expect(kds.id).toBe(created.body.id);
    expect(kds.items).toHaveLength(1);

    // KDS receives status updates too.
    const updateEvent = waitFor<{ id: string; status: string }>(kitchenSocket, "order.updated");
    await request(http)
      .post(`/orders/${created.body.id}/status`)
      .set("Authorization", `Bearer ${ownerA}`)
      .send({ status: "confirmed" })
      .expect(200);
    const updated = await updateEvent;
    expect(updated.id).toBe(created.body.id);
    expect(updated.status).toBe("confirmed");
  });

  it("does NOT leak events across tenants", async () => {
    const socketB = connect(ownerB);
    await waitFor(socketB, "connect");
    expect((await subscribe(socketB, { channel: "orders" })).ok).toBe(true);

    let leaked = false;
    socketB.on("order.created", () => {
      leaked = true;
    });

    await createOrder(ownerA, {
      type: "walkin",
      branchId: branchA,
      items: [{ productId: fx.simple.id, quantity: 1 }],
    }).expect(201);

    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(leaked).toBe(false);
  });
});

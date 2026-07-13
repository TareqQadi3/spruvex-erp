import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../../src/app.module";

describe("health checks (e2e)", () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication["getHttpServer"]>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it("liveness probe requires no auth and no dependency checks", async () => {
    const res = await request(http).get("/health").expect(200);
    expect(res.body.status).toBe("ok");
  });

  it("readiness probe reports the database as reachable", async () => {
    const res = await request(http).get("/health/ready").expect(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.checks.database).toBe("ok");
    expect(["ok", "down", "not_configured"]).toContain(res.body.checks.redis);
  });
});

import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { checkDatabaseConnection } from "../core/database/connection";
import { getRedisClient } from "../core/cache/redisClient";

const router: IRouter = Router();

// Liveness: process is up and can respond — no dependency checks, so a
// misbehaving database/Redis never makes an orchestrator kill and restart a
// perfectly healthy process (that would just create a restart loop).
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Readiness: can this instance actually serve real traffic right now — used
// by a load balancer/orchestrator to decide whether to route requests here.
// Redis is checked only when configured (REDIS_URL unset is a valid,
// supported single-instance mode — see rateLimit/cache in-process fallback
// — so its absence must never fail readiness).
router.get("/readyz", async (_req, res) => {
  const checks: Record<string, "ok" | "error"> = { database: "ok" };

  try {
    await checkDatabaseConnection();
  } catch {
    checks.database = "error";
  }

  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.ping();
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
    }
  }

  const healthy = Object.values(checks).every((status) => status === "ok");
  res.status(healthy ? 200 : 503).json({ status: healthy ? "ok" : "error", checks });
});

export default router;

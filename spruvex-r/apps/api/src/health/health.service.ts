import { Injectable, Logger } from "@nestjs/common";
import { createClient } from "redis";

import { PrismaService } from "../shared/prisma/prisma.service";

export interface HealthReport {
  status: "ok" | "degraded";
  service: string;
  uptimeSeconds: number;
  checks: {
    database: "ok" | "down";
    redis: "ok" | "down" | "not_configured";
  };
}

/**
 * Readiness checks for load balancers / orchestrators (Phase 8 monitoring
 * foundation). Redis is best-effort — the API degrades to the in-memory
 * socket adapter when it's unreachable (see RedisIoAdapter), so a Redis
 * outage is reported but doesn't flip overall status to "degraded" by
 * itself; a database outage does, since nothing works without it.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthReport> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    return {
      status: database === "ok" ? "ok" : "degraded",
      service: "spruvex-r-api",
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database, redis },
    };
  }

  private async checkDatabase(): Promise<"ok" | "down"> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return "ok";
    } catch (error) {
      this.logger.error(`Database health check failed: ${(error as Error).message}`);
      return "down";
    }
  }

  private async checkRedis(): Promise<"ok" | "down" | "not_configured"> {
    const url = process.env.REDIS_URL;
    if (!url) {
      return "not_configured";
    }
    const client = createClient({ url, socket: { connectTimeout: 2000 } });
    try {
      await client.connect();
      await client.ping();
      return "ok";
    } catch (error) {
      this.logger.warn(`Redis health check failed: ${(error as Error).message}`);
      return "down";
    } finally {
      await client.quit().catch(() => undefined);
    }
  }
}

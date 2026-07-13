import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import type { Response } from "express";

import { Public } from "../shared/rbac/public.decorator";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Cheap liveness probe — process is up, no dependency checks. */
  @Public()
  @Get()
  liveness() {
    return { status: "ok", service: "spruvex-r-api" };
  }

  /** Readiness probe — checks the database (and best-effort Redis). */
  @Public()
  @Get("ready")
  async readiness(@Res({ passthrough: true }) res: Response) {
    const report = await this.health.check();
    res.status(report.status === "ok" ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return report;
  }
}

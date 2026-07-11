import { Controller, Get } from "@nestjs/common";

import { Public } from "../shared/rbac/public.decorator";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  health() {
    return { status: "ok", service: "spruvex-r-api" };
  }
}

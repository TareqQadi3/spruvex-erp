import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { Public } from "../../shared/rbac/public.decorator";
import { CurrentPlatformAdmin } from "./current-platform-admin.decorator";
import { PlatformLoginDto } from "./dto/platform-auth.dto";
import { PlatformAdminGuard } from "./platform-admin.guard";
import { PlatformAuthService } from "./platform-auth.service";

@Public()
@Controller("platform/auth")
export class PlatformAuthController {
  constructor(private readonly auth: PlatformAuthService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post("login")
  login(@Body() dto: PlatformLoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @UseGuards(PlatformAdminGuard)
  @Get("me")
  me(@CurrentPlatformAdmin() admin: { id: string; email: string; name: string }) {
    return { id: admin.id, email: admin.email, name: admin.name };
  }
}

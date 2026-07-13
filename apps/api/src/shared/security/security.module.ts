import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

/**
 * Global rate limiting (Phase 8 security review). Every request gets a
 * baseline per-IP limit; sensitive endpoints (auth, platform login) apply a
 * tighter @Throttle() override on top. Previously only the guest ordering
 * endpoints had any throttling — login/register/OTP had none beyond the
 * per-account lockout, which doesn't stop credential-stuffing across many
 * different accounts from one IP.
 */
@Global()
@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 120 }]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class SecurityModule {}

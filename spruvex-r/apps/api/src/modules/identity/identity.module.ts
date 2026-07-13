import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { DevOtpSender, OTP_SENDER } from "./otp/otp-sender";
import { OtpService } from "./otp/otp.service";
import { TokenService } from "./token.service";

/**
 * Identity module — registration, OTP verification, login/logout,
 * JWT access + rotating refresh tokens, account lockout.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    OtpService,
    { provide: OTP_SENDER, useClass: DevOtpSender },
  ],
  exports: [AuthService, TokenService],
})
export class IdentityModule {}

import { Injectable, Logger } from "@nestjs/common";

export const OTP_SENDER = "spruvex:otpSender";

export type OtpPurpose = "email_verification" | "password_reset" | "login";

/**
 * Delivery port for one-time codes. The MVP ships only the development
 * implementation; an SMS provider (e.g. Unifonic/Twilio) or email sender
 * implements this interface later without touching the auth flow.
 */
export interface OtpSender {
  send(destination: string, code: string, purpose: OtpPurpose): Promise<void>;
}

@Injectable()
export class DevOtpSender implements OtpSender {
  private readonly logger = new Logger("OTP");

  async send(destination: string, code: string, purpose: OtpPurpose): Promise<void> {
    this.logger.log(`[dev] OTP for ${destination} (${purpose}): ${code}`);
  }
}

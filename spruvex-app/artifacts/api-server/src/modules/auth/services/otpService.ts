import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { registrationOtpsTable } from "@workspace/db";
import { db } from "../../../core/database/connection";
import { AppError } from "../../../core/errors/AppError";
import { sendEmail } from "../../../core/email/resendService";
import { otpEmail } from "../../../core/email/templates";

export type OtpPurpose = "registration" | "password_reset";

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 10;

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function requestOtp(email: string, purpose: OtpPurpose): Promise<void> {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await db
    .insert(registrationOtpsTable)
    .values({ email, purpose, codeHash, attempts: 0, expiresAt })
    .onConflictDoUpdate({
      target: [registrationOtpsTable.email, registrationOtpsTable.purpose],
      set: { codeHash, attempts: 0, expiresAt, createdAt: new Date() },
    });

  const { subject, html } = otpEmail(code, purpose);
  await sendEmail(email, subject, html);
}

export async function requestRegistrationOtp(email: string): Promise<void> {
  await requestOtp(email, "registration");
}

/** Verifies and consumes the OTP row for `email`/`purpose`. Throws on mismatch/expiry/too-many-attempts. */
export async function verifyOtp(email: string, purpose: OtpPurpose, code: string): Promise<void> {
  const [row] = await db
    .select()
    .from(registrationOtpsTable)
    .where(and(eq(registrationOtpsTable.email, email), eq(registrationOtpsTable.purpose, purpose)))
    .limit(1);

  if (!row) {
    throw AppError.validation("No verification code was requested for this email");
  }
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(registrationOtpsTable).where(eq(registrationOtpsTable.id, row.id));
    throw AppError.validation("Verification code has expired, request a new one");
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await db.delete(registrationOtpsTable).where(eq(registrationOtpsTable.id, row.id));
    throw AppError.validation("Too many attempts, request a new code");
  }

  const valid = await bcrypt.compare(code, row.codeHash);
  if (!valid) {
    await db
      .update(registrationOtpsTable)
      .set({ attempts: row.attempts + 1 })
      .where(eq(registrationOtpsTable.id, row.id));
    throw AppError.validation("Invalid verification code");
  }

  await db.delete(registrationOtpsTable).where(eq(registrationOtpsTable.id, row.id));
}

export async function verifyRegistrationOtp(email: string, code: string): Promise<void> {
  await verifyOtp(email, "registration", code);
}

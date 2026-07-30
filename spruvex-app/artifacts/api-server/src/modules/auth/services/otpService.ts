import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { registrationOtpsTable } from "@workspace/db";
import { db } from "../../../core/database/connection";
import { AppError } from "../../../core/errors/AppError";
import { sendEmail } from "../../../core/email/resendService";
import { otpEmail } from "../../../core/email/templates";

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 10;

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function requestRegistrationOtp(email: string): Promise<void> {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await db
    .insert(registrationOtpsTable)
    .values({ email, codeHash, attempts: 0, expiresAt })
    .onConflictDoUpdate({
      target: registrationOtpsTable.email,
      set: { codeHash, attempts: 0, expiresAt, createdAt: new Date() },
    });

  const { subject, html } = otpEmail(code);
  await sendEmail(email, subject, html);
}

/** Verifies and consumes the OTP row for `email`. Throws on mismatch/expiry/too-many-attempts. */
export async function verifyRegistrationOtp(email: string, code: string): Promise<void> {
  const [row] = await db
    .select()
    .from(registrationOtpsTable)
    .where(eq(registrationOtpsTable.email, email))
    .limit(1);

  if (!row) {
    throw AppError.validation("No verification code was requested for this email");
  }
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(registrationOtpsTable).where(eq(registrationOtpsTable.email, email));
    throw AppError.validation("Verification code has expired, request a new one");
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await db.delete(registrationOtpsTable).where(eq(registrationOtpsTable.email, email));
    throw AppError.validation("Too many attempts, request a new code");
  }

  const valid = await bcrypt.compare(code, row.codeHash);
  if (!valid) {
    await db
      .update(registrationOtpsTable)
      .set({ attempts: row.attempts + 1 })
      .where(eq(registrationOtpsTable.email, email));
    throw AppError.validation("Invalid verification code");
  }

  await db.delete(registrationOtpsTable).where(eq(registrationOtpsTable.email, email));
}

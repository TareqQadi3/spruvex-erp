import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { registrationOtpsTable } from "@workspace/db";
import { db } from "../../../core/database/connection";
import { AppError } from "../../../core/errors/AppError";
import { logger } from "../../../core/logging/logger";
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

  // Without a real mail provider (RESEND_API_KEY unset) the code is never
  // sent anywhere — reveal it in the dev log so local signup/reset testing
  // stays possible. Guarded on the env var so production (where the key is
  // set) never logs a live OTP.
  if (!process.env.RESEND_API_KEY) {
    logger.warn({ email, purpose }, `[DEV] OTP code for ${email}: ${code}`);
  }

  const { subject, html } = otpEmail(code, purpose);
  await sendEmail(email, subject, html);
}

export async function requestRegistrationOtp(email: string): Promise<void> {
  await requestOtp(email, "registration");
}

// `consume` controls whether a *successful* check deletes the row. Both the
// real verify (registration/reset actually completing) and the early
// "is this code still good" peek from the signup wizard's step 2 run
// through the exact same expiry/attempts/hash logic and share the same
// attempt-throttling on failure — only the happy-path row deletion differs,
// so a wizard peek doesn't burn the code the final submit still needs.
async function checkOrVerifyOtp(email: string, purpose: OtpPurpose, code: string, consume: boolean): Promise<void> {
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

  if (consume) {
    await db.delete(registrationOtpsTable).where(eq(registrationOtpsTable.id, row.id));
  }
}

/** Verifies and consumes the OTP row for `email`/`purpose`. Throws on mismatch/expiry/too-many-attempts. */
export async function verifyOtp(email: string, purpose: OtpPurpose, code: string): Promise<void> {
  await checkOrVerifyOtp(email, purpose, code, true);
}

/**
 * Same checks as verifyOtp, but never deletes the row on success — lets the
 * signup wizard confirm a code is correct right after entry (step 2) instead
 * of only discovering it was wrong/expired at final submit (after business
 * type + plan are also picked). The real, consuming check still happens at
 * registerCompany — a code that passes this peek but expires in the few
 * minutes before final submit is still caught there.
 */
export async function checkOtp(email: string, purpose: OtpPurpose, code: string): Promise<void> {
  await checkOrVerifyOtp(email, purpose, code, false);
}

export async function verifyRegistrationOtp(email: string, code: string): Promise<void> {
  await verifyOtp(email, "registration", code);
}

export async function checkRegistrationOtp(email: string, code: string): Promise<void> {
  await checkOtp(email, "registration", code);
}

// Thin wrapper over Resend's REST API (no SDK dependency — one POST with
// fetch, which Node 22 ships natively). Used for every transactional email
// the ERP sends: signup OTP, welcome + login credentials.
//
// Falls back to logging (never throwing) when RESEND_API_KEY is unset, so
// local dev/CI never needs a real key. Never lets a broken email provider
// break the request that triggered it (registration, OTP request, ...).

import { logger } from "../logging/logger";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM_EMAIL ?? "SpruVex <onboarding@resend.dev>";

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!apiKey) {
    logger.warn({ to, subject }, "RESEND_API_KEY not set — skipping email");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error({ to, status: res.status, body }, "Resend send failed");
    }
  } catch (err) {
    // Network-level failure (DNS, connection reset, Resend outage): log it so
    // the caller can decide whether the business action should still succeed
    // (e.g. an already-committed signup), instead of throwing up into a 500.
    logger.error({ to, subject, err: (err as Error).message }, "Resend send failed (network)");
  }
}

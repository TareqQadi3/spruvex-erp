// mada (and Visa/Mastercard) card payments ride through the Moyasar PSP —
// mada is a card network, not an API, so there is no separate "mada API" to
// integrate against; this adapter talks to Moyasar's documented public API
// (https://api.moyasar.com/v1), NOT yet verified against a live sandbox —
// SpruVex has no Moyasar merchant account yet. Verify request/response
// shapes during first real merchant onboarding.
import { timingSafeEqual } from "node:crypto";
import { AppError } from "../../../core/errors/AppError";
import { toCents } from "../../../shared/utils/money";
import type { CreateCheckoutInput, PaymentGatewayConfig, PaymentProvider, PaymentStatus } from "./types";

const MOYASAR_BASE_URL = "https://api.moyasar.com/v1";

function authHeaders(cfg: PaymentGatewayConfig): Record<string, string> {
  const secretKey = cfg.credentials.secretKey;
  if (typeof secretKey !== "string" || !secretKey) {
    throw AppError.validation("Moyasar secretKey is not configured");
  }
  const basic = Buffer.from(`${secretKey}:`).toString("base64");
  return {
    authorization: `Basic ${basic}`,
    "content-type": "application/json",
  };
}

function mapInvoiceStatus(status: string): PaymentStatus {
  switch (status) {
    case "paid":
      return "captured";
    case "failed":
    case "expired":
      return "failed";
    case "canceled":
      return "cancelled";
    case "initiated":
    default:
      return "pending";
  }
}

interface MoyasarInvoiceResponse {
  id?: string;
  url?: string;
  status?: string;
  payments?: Array<{ id?: string }>;
}

export const moyasarProvider: PaymentProvider = {
  name: "moyasar",

  async createCheckout(
    cfg: PaymentGatewayConfig,
    input: CreateCheckoutInput,
  ): Promise<{ externalId: string; checkoutUrl?: string; status: PaymentStatus }> {
    const body = {
      amount: toCents(input.amount),
      currency: input.currency,
      description: input.description,
      callback_url: input.successUrl,
      metadata: { reference: input.reference },
    };

    const response = await fetch(`${MOYASAR_BASE_URL}/invoices`, {
      method: "POST",
      headers: authHeaders(cfg),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw AppError.internal(`Moyasar invoice creation failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as MoyasarInvoiceResponse;
    if (!data.id) throw AppError.internal("Moyasar invoice response missing id");

    return { externalId: data.id, checkoutUrl: data.url, status: "pending" };
  },

  async getStatus(cfg: PaymentGatewayConfig, externalId: string): Promise<PaymentStatus> {
    const response = await fetch(`${MOYASAR_BASE_URL}/invoices/${externalId}`, {
      method: "GET",
      headers: authHeaders(cfg),
    });
    if (!response.ok) {
      throw AppError.internal(`Moyasar status lookup failed: HTTP ${response.status}`);
    }
    const data = (await response.json()) as MoyasarInvoiceResponse;
    return mapInvoiceStatus(data.status ?? "initiated");
  },

  async refund(cfg: PaymentGatewayConfig, externalId: string, amount: number): Promise<{ status: PaymentStatus }> {
    // Invoices have no direct refund endpoint — refund the invoice's
    // underlying payment instead.
    const invoiceResponse = await fetch(`${MOYASAR_BASE_URL}/invoices/${externalId}`, {
      method: "GET",
      headers: authHeaders(cfg),
    });
    if (!invoiceResponse.ok) {
      throw AppError.internal(`Moyasar invoice lookup failed: HTTP ${invoiceResponse.status}`);
    }
    const invoice = (await invoiceResponse.json()) as MoyasarInvoiceResponse;
    const paymentId = invoice.payments?.[0]?.id;
    if (!paymentId) throw AppError.internal("Moyasar invoice has no payment to refund");

    const refundResponse = await fetch(`${MOYASAR_BASE_URL}/payments/${paymentId}/refund`, {
      method: "POST",
      headers: authHeaders(cfg),
      body: JSON.stringify({ amount: toCents(amount) }),
    });
    if (!refundResponse.ok) {
      throw AppError.internal(`Moyasar refund failed: HTTP ${refundResponse.status}`);
    }
    return { status: "refunded" };
  },

  verifyWebhook(
    cfg: PaymentGatewayConfig,
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): boolean {
    const secret = cfg.credentials.webhookSecret;
    if (typeof secret !== "string" || !secret) return false;

    let candidate: unknown;
    const headerValueRaw = headers["x-moyasar-secret"];
    const headerValue = Array.isArray(headerValueRaw) ? headerValueRaw[0] : headerValueRaw;
    if (typeof headerValue === "string" && headerValue) {
      candidate = headerValue;
    } else {
      try {
        const parsed = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
        candidate = parsed.secret_token;
      } catch {
        candidate = undefined;
      }
    }

    if (typeof candidate !== "string" || !candidate) return false;
    const secretBuf = Buffer.from(secret, "utf8");
    const candidateBuf = Buffer.from(candidate, "utf8");
    if (secretBuf.length !== candidateBuf.length) return false;
    return timingSafeEqual(secretBuf, candidateBuf);
  },

  parseWebhook(payload: unknown): { externalId: string; status: PaymentStatus } | null {
    if (!payload || typeof payload !== "object") return null;
    const body = payload as Record<string, unknown>;
    const data = (body.data && typeof body.data === "object" ? body.data : body) as Record<string, unknown>;
    const id = data.id ?? body.id;
    const status = data.status ?? body.status;
    if (typeof id !== "string" || typeof status !== "string") return null;
    return { externalId: id, status: mapInvoiceStatus(status) };
  },
};

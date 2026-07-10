// Implemented against Tabby's documented public Checkout API
// (https://api.tabby.ai/api/v2), NOT yet verified against a live sandbox —
// SpruVex has no Tabby merchant account yet. Verify request/response shapes
// during first real merchant onboarding.
import { timingSafeEqual } from "node:crypto";
import { AppError } from "../../../core/errors/AppError";
import type { CreateCheckoutInput, PaymentGatewayConfig, PaymentProvider, PaymentStatus } from "./types";

const TABBY_BASE_URL = "https://api.tabby.ai/api/v2";

function authHeaders(cfg: PaymentGatewayConfig): Record<string, string> {
  const secretKey = cfg.credentials.secretKey;
  if (typeof secretKey !== "string" || !secretKey) {
    throw AppError.validation("Tabby secretKey is not configured");
  }
  return {
    authorization: `Bearer ${secretKey}`,
    "content-type": "application/json",
  };
}

function mapStatus(tabbyStatus: string): PaymentStatus {
  switch (tabbyStatus) {
    case "AUTHORIZED":
    case "CLOSED":
      return "captured";
    case "REJECTED":
    case "EXPIRED":
      return "failed";
    case "CREATED":
    default:
      return "pending";
  }
}

interface TabbyCheckoutResponse {
  payment?: { id?: string; status?: string };
  status?: string;
  id?: string;
  configuration?: {
    available_products?: {
      installments?: Array<{ web_url?: string }>;
    };
  };
  web_url?: string;
  checkout_url?: string;
}

function extractCheckoutUrl(data: TabbyCheckoutResponse): string | undefined {
  const installmentUrl = data.configuration?.available_products?.installments?.[0]?.web_url;
  return installmentUrl ?? data.web_url ?? data.checkout_url ?? undefined;
}

export const tabbyProvider: PaymentProvider = {
  name: "tabby",

  async createCheckout(
    cfg: PaymentGatewayConfig,
    input: CreateCheckoutInput,
  ): Promise<{ externalId: string; checkoutUrl?: string; status: PaymentStatus }> {
    const body = {
      payment: {
        amount: input.amount.toFixed(2),
        currency: input.currency,
        description: input.description,
        buyer:
          input.customerName || input.customerPhone
            ? {
                ...(input.customerName ? { name: input.customerName } : {}),
                ...(input.customerPhone ? { phone: input.customerPhone } : {}),
              }
            : undefined,
        order: { reference_id: input.reference },
      },
      merchant_code: cfg.credentials.merchantCode,
      merchant_urls: {
        success: input.successUrl,
        cancel: input.cancelUrl,
        failure: input.cancelUrl,
      },
    };

    const response = await fetch(`${TABBY_BASE_URL}/checkout`, {
      method: "POST",
      headers: authHeaders(cfg),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw AppError.internal(`Tabby checkout failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as TabbyCheckoutResponse;
    const externalId = data.payment?.id ?? data.id;
    if (!externalId) throw AppError.internal("Tabby checkout response missing payment id");

    const status = mapStatus(data.payment?.status ?? data.status ?? "CREATED");
    return { externalId, checkoutUrl: extractCheckoutUrl(data), status };
  },

  async getStatus(cfg: PaymentGatewayConfig, externalId: string): Promise<PaymentStatus> {
    const response = await fetch(`${TABBY_BASE_URL}/payments/${externalId}`, {
      method: "GET",
      headers: authHeaders(cfg),
    });
    if (!response.ok) {
      throw AppError.internal(`Tabby status lookup failed: HTTP ${response.status}`);
    }
    const data = (await response.json()) as { status?: string };
    return mapStatus(data.status ?? "CREATED");
  },

  async refund(cfg: PaymentGatewayConfig, externalId: string, amount: number): Promise<{ status: PaymentStatus }> {
    const response = await fetch(`${TABBY_BASE_URL}/payments/${externalId}/refunds`, {
      method: "POST",
      headers: authHeaders(cfg),
      body: JSON.stringify({ amount: amount.toFixed(2) }),
    });
    if (!response.ok) {
      throw AppError.internal(`Tabby refund failed: HTTP ${response.status}`);
    }
    return { status: "refunded" };
  },

  verifyWebhook(
    cfg: PaymentGatewayConfig,
    headers: Record<string, string | string[] | undefined>,
    _rawBody: Buffer,
  ): boolean {
    // Tabby registers a header-auth webhook (no HMAC signature) — the
    // registered secret is expected back verbatim in a header.
    const secret = cfg.credentials.webhookSecret;
    if (typeof secret !== "string" || !secret) return false;

    const rawHeader = headers["x-tabby-signature"] ?? headers["authorization"];
    const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (typeof headerValue !== "string" || !headerValue) return false;

    const normalized = headerValue.startsWith("Bearer ") ? headerValue.slice(7) : headerValue;
    const secretBuf = Buffer.from(secret, "utf8");
    const headerBuf = Buffer.from(normalized, "utf8");
    if (secretBuf.length !== headerBuf.length) return false;
    return timingSafeEqual(secretBuf, headerBuf);
  },

  parseWebhook(payload: unknown): { externalId: string; status: PaymentStatus } | null {
    if (!payload || typeof payload !== "object") return null;
    const body = payload as Record<string, unknown>;
    const id = body.id;
    const status = body.status;
    if (typeof id !== "string" || typeof status !== "string") return null;
    return { externalId: id, status: mapStatus(status) };
  },
};

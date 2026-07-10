// Implemented against Tamara's documented public Checkout API
// (https://api.tamara.co / sandbox https://api-sandbox.tamara.co), NOT yet
// verified against a live sandbox — SpruVex has no Tamara merchant account
// yet. Verify request/response shapes during first real merchant onboarding.
import { timingSafeEqual } from "node:crypto";
import { AppError } from "../../../core/errors/AppError";
import type { CreateCheckoutInput, PaymentGatewayConfig, PaymentProvider, PaymentStatus } from "./types";

function baseUrl(cfg: PaymentGatewayConfig): string {
  return cfg.mode === "live" ? "https://api.tamara.co" : "https://api-sandbox.tamara.co";
}

function authHeaders(cfg: PaymentGatewayConfig): Record<string, string> {
  const apiToken = cfg.credentials.apiToken;
  if (typeof apiToken !== "string" || !apiToken) {
    throw AppError.validation("Tamara apiToken is not configured");
  }
  return {
    authorization: `Bearer ${apiToken}`,
    "content-type": "application/json",
  };
}

function mapOrderStatus(status: string): PaymentStatus {
  switch (status) {
    case "approved":
    case "fully_captured":
      return "captured";
    case "declined":
    case "expired":
      return "failed";
    case "canceled":
      return "cancelled";
    case "new":
    default:
      return "pending";
  }
}

interface TamaraCheckoutResponse {
  order_id?: string;
  checkout_url?: string;
  status?: string;
}

export const tamaraProvider: PaymentProvider = {
  name: "tamara",

  async createCheckout(
    cfg: PaymentGatewayConfig,
    input: CreateCheckoutInput,
  ): Promise<{ externalId: string; checkoutUrl?: string; status: PaymentStatus }> {
    const body = {
      order_reference_id: input.reference,
      total_amount: { amount: input.amount.toFixed(2), currency: input.currency },
      description: input.description,
      consumer: {
        first_name: input.customerName ?? "Customer",
        last_name: "-",
        phone_number: input.customerPhone ?? "",
      },
      country_code: "SA",
      payment_type: "PAY_BY_INSTALMENTS",
      merchant_url: {
        success: input.successUrl,
        failure: input.cancelUrl,
        cancel: input.cancelUrl,
        notification: undefined,
      },
      items: [
        {
          name: input.description,
          type: "General",
          reference_id: input.reference,
          sku: input.reference,
          quantity: 1,
          unit_price: { amount: input.amount.toFixed(2), currency: input.currency },
          total_amount: { amount: input.amount.toFixed(2), currency: input.currency },
        },
      ],
    };

    const response = await fetch(`${baseUrl(cfg)}/checkout`, {
      method: "POST",
      headers: authHeaders(cfg),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw AppError.internal(`Tamara checkout failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as TamaraCheckoutResponse;
    if (!data.order_id) throw AppError.internal("Tamara checkout response missing order_id");

    return { externalId: data.order_id, checkoutUrl: data.checkout_url, status: "pending" };
  },

  async getStatus(cfg: PaymentGatewayConfig, externalId: string): Promise<PaymentStatus> {
    const response = await fetch(`${baseUrl(cfg)}/orders/${externalId}`, {
      method: "GET",
      headers: authHeaders(cfg),
    });
    if (!response.ok) {
      throw AppError.internal(`Tamara status lookup failed: HTTP ${response.status}`);
    }
    const data = (await response.json()) as { status?: string };
    return mapOrderStatus(data.status ?? "new");
  },

  async refund(cfg: PaymentGatewayConfig, externalId: string, amount: number): Promise<{ status: PaymentStatus }> {
    const response = await fetch(`${baseUrl(cfg)}/payments/simplified-refund/${externalId}`, {
      method: "POST",
      headers: authHeaders(cfg),
      body: JSON.stringify({ total_amount: { amount: amount.toFixed(2), currency: "SAR" } }),
    });
    if (!response.ok) {
      throw AppError.internal(`Tamara refund failed: HTTP ${response.status}`);
    }
    return { status: "refunded" };
  },

  verifyWebhook(
    cfg: PaymentGatewayConfig,
    headers: Record<string, string | string[] | undefined>,
    _rawBody: Buffer,
  ): boolean {
    const secret = cfg.credentials.notificationToken;
    if (typeof secret !== "string" || !secret) return false;

    const rawHeader = headers["tamara-token"];
    const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (typeof headerValue !== "string" || !headerValue) return false;

    const secretBuf = Buffer.from(secret, "utf8");
    const headerBuf = Buffer.from(headerValue, "utf8");
    if (secretBuf.length !== headerBuf.length) return false;
    return timingSafeEqual(secretBuf, headerBuf);
  },

  parseWebhook(payload: unknown): { externalId: string; status: PaymentStatus } | null {
    if (!payload || typeof payload !== "object") return null;
    const body = payload as Record<string, unknown>;
    const orderId = body.order_id;
    const eventType = body.event_type;
    if (typeof orderId !== "string" || typeof eventType !== "string") return null;

    let status: PaymentStatus;
    switch (eventType) {
      case "order_approved":
      case "order_captured":
        status = "captured";
        break;
      case "order_canceled":
        status = "cancelled";
        break;
      case "order_declined":
        status = "failed";
        break;
      default:
        status = "pending";
    }
    return { externalId: orderId, status };
  },
};

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  EcommerceConnectionConfig,
  EcommerceProvider,
  ExternalOrder,
  ExternalOrderItem,
  PushProductInput,
} from "./types";

// Deterministic, no-network, DB-free provider: lets dev/tests exercise the
// full connect -> push -> pull -> webhook -> import flow without a real
// merchant account. Mirrors modules/ai/providers/mockProvider.ts.

function computeSignature(secret: string, rawBody: Buffer): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

function safeEqualHex(expectedHex: string, actualHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function isExternalOrderItem(value: unknown): value is ExternalOrderItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.externalProductId === "string" &&
    typeof item.name === "string" &&
    typeof item.quantity === "number" &&
    typeof item.unitPrice === "number"
  );
}

export const mockProvider: EcommerceProvider = {
  name: "mock",

  async testConnection(cfg: EcommerceConnectionConfig): Promise<{ ok: boolean; storeName?: string; message?: string }> {
    if (typeof cfg.credentials.webhookSecret === "string" && cfg.credentials.webhookSecret.length > 0) {
      return { ok: true, storeName: "Mock Store" };
    }
    return { ok: false, message: "Missing webhookSecret in credentials" };
  },

  async pushProduct(_cfg: EcommerceConnectionConfig, product: PushProductInput): Promise<{ externalId: string; externalSku?: string }> {
    return { externalId: `mock-${product.sku ?? product.id}` };
  },

  async pullOrders(_cfg: EcommerceConnectionConfig, _since?: Date | null): Promise<ExternalOrder[]> {
    return [
      {
        externalOrderId: "mock-order-pull-1",
        externalOrderNumber: "MOCK-1001",
        customerName: "Mock Customer",
        total: 100,
        currency: "SAR",
        items: [{ externalProductId: "mock-unmapped-product", name: "Mock Item", quantity: 1, unitPrice: 100 }],
        raw: {
          externalOrderId: "mock-order-pull-1",
          externalOrderNumber: "MOCK-1001",
          customerName: "Mock Customer",
          total: 100,
          currency: "SAR",
          items: [{ externalProductId: "mock-unmapped-product", name: "Mock Item", quantity: 1, unitPrice: 100 }],
        },
      },
    ];
  },

  verifyWebhook(cfg: EcommerceConnectionConfig, headers: Record<string, string | string[] | undefined>, rawBody: Buffer): boolean {
    const secret = cfg.credentials.webhookSecret;
    const header = headers["x-mock-signature"];
    if (typeof secret !== "string" || !secret || typeof header !== "string" || !header) return false;

    const expected = computeSignature(secret, rawBody);
    try {
      return safeEqualHex(expected, header);
    } catch {
      return false;
    }
  },

  parseOrderWebhook(payload: unknown): ExternalOrder | null {
    if (!payload || typeof payload !== "object") return null;
    const body = payload as Record<string, unknown>;

    if (typeof body.externalOrderId !== "string" || typeof body.total !== "number" || !Array.isArray(body.items)) {
      return null;
    }
    if (!body.items.every(isExternalOrderItem)) return null;

    return {
      externalOrderId: body.externalOrderId,
      externalOrderNumber: typeof body.externalOrderNumber === "string" ? body.externalOrderNumber : undefined,
      customerName: typeof body.customerName === "string" ? body.customerName : undefined,
      customerPhone: typeof body.customerPhone === "string" ? body.customerPhone : undefined,
      currency: typeof body.currency === "string" ? body.currency : undefined,
      total: body.total,
      items: body.items as ExternalOrderItem[],
      raw: payload,
    };
  },
};

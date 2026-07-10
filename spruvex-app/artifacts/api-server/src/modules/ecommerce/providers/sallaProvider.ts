// Implemented against Salla's documented public Admin API v2
// (https://docs.salla.dev/) but NOT yet verified against a live sandbox — no
// merchant account was available while building this. Verify request/response
// shapes during the first real Salla merchant onboarding and adjust mapping
// as needed.
import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../../../core/errors/AppError";
import type {
  EcommerceConnectionConfig,
  EcommerceProvider,
  ExternalOrder,
  PushProductInput,
} from "./types";

const SALLA_BASE_URL = "https://api.salla.dev/admin/v2";

function authHeaders(cfg: EcommerceConnectionConfig): Record<string, string> {
  const accessToken = cfg.credentials.accessToken;
  return {
    Authorization: `Bearer ${typeof accessToken === "string" ? accessToken : ""}`,
    "content-type": "application/json",
  };
}

async function sallaRequest(cfg: EcommerceConnectionConfig, path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${SALLA_BASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(cfg), ...(init?.headers ?? {}) },
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: { message?: string }; message?: string };
      detail = body?.error?.message ?? body?.message ?? detail;
    } catch {
      // response wasn't JSON — keep the status-only detail
    }
    throw AppError.internal(`Salla API error: ${detail}`);
  }

  return response.json();
}

function mapSallaOrderToExternalOrder(order: Record<string, unknown>): ExternalOrder {
  const amounts = (order.amounts as Record<string, unknown> | undefined) ?? {};
  const total = amounts.total as Record<string, unknown> | undefined;
  const customer = (order.customer as Record<string, unknown> | undefined) ?? {};
  const items = Array.isArray(order.items) ? (order.items as Record<string, unknown>[]) : [];

  return {
    externalOrderId: String(order.id ?? order.reference_id ?? ""),
    externalOrderNumber: order.reference_id ? String(order.reference_id) : undefined,
    customerName: customer.first_name || customer.last_name
      ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
      : undefined,
    customerPhone: typeof customer.mobile === "string" ? customer.mobile : undefined,
    currency: typeof total?.currency === "string" ? total.currency : undefined,
    total: Number(total?.amount ?? order.total ?? 0),
    items: items.map((item) => ({
      externalProductId: String(item.product_id ?? item.id ?? ""),
      name: String(item.name ?? ""),
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number((item.amounts as Record<string, unknown> | undefined)?.total ?? item.price ?? 0),
    })),
    raw: order,
  };
}

export const sallaProvider: EcommerceProvider = {
  name: "salla",

  async testConnection(cfg: EcommerceConnectionConfig): Promise<{ ok: boolean; storeName?: string; message?: string }> {
    try {
      const result = (await sallaRequest(cfg, "/store/info")) as { data?: { name?: string } };
      return { ok: true, storeName: result?.data?.name };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Unknown error" };
    }
  },

  async pushProduct(cfg: EcommerceConnectionConfig, product: PushProductInput): Promise<{ externalId: string; externalSku?: string }> {
    const body = JSON.stringify({
      name: product.name,
      price: Number(product.sellingPrice),
      sku: product.sku ?? undefined,
      description: product.description ?? undefined,
    });

    const result = (await sallaRequest(
      cfg,
      product.existingExternalId ? `/products/${product.existingExternalId}` : "/products",
      { method: product.existingExternalId ? "PUT" : "POST", body },
    )) as { data?: { id?: string | number; sku?: string } };

    const externalId = product.existingExternalId ?? String(result?.data?.id ?? "");
    return { externalId, externalSku: result?.data?.sku };
  },

  async pullOrders(cfg: EcommerceConnectionConfig, since?: Date | null): Promise<ExternalOrder[]> {
    const query = since ? `?from_date=${encodeURIComponent(since.toISOString())}` : "";
    const result = (await sallaRequest(cfg, `/orders${query}`)) as { data?: Record<string, unknown>[] };
    const orders = result?.data ?? [];
    return orders.map(mapSallaOrderToExternalOrder);
  },

  verifyWebhook(cfg: EcommerceConnectionConfig, headers: Record<string, string | string[] | undefined>, rawBody: Buffer): boolean {
    const secret = cfg.credentials.webhookSecret;
    const header = headers["x-salla-signature"];
    if (typeof secret !== "string" || !secret || typeof header !== "string" || !header) return false;

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(header, "hex");
    if (expectedBuf.length !== actualBuf.length) return false;
    try {
      return timingSafeEqual(expectedBuf, actualBuf);
    } catch {
      return false;
    }
  },

  parseOrderWebhook(payload: unknown): ExternalOrder | null {
    if (!payload || typeof payload !== "object") return null;
    const envelope = payload as { event?: string; data?: Record<string, unknown> };
    if (envelope.event !== "order.created" || !envelope.data) return null;
    try {
      return mapSallaOrderToExternalOrder(envelope.data);
    } catch {
      return null;
    }
  },
};

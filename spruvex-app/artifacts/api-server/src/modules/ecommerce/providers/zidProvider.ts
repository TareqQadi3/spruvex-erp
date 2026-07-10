// Implemented against Zid's documented public API
// (https://docs.zid.sa/) but NOT yet verified against a live sandbox — no
// merchant account was available while building this. Verify request/response
// shapes during the first real Zid merchant onboarding and adjust mapping
// as needed.
import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../../../core/errors/AppError";
import type {
  EcommerceConnectionConfig,
  EcommerceProvider,
  ExternalOrder,
  PushProductInput,
} from "./types";

const ZID_BASE_URL = "https://api.zid.sa/v1";

function authHeaders(cfg: EcommerceConnectionConfig): Record<string, string> {
  const authorization = cfg.credentials.authorization;
  const managerToken = cfg.credentials.managerToken;
  const storeId = cfg.credentials.storeId;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${typeof authorization === "string" ? authorization : ""}`,
    "X-Manager-Token": typeof managerToken === "string" ? managerToken : "",
    "content-type": "application/json",
  };
  if (typeof storeId === "string" && storeId) headers["Store-Id"] = storeId;
  return headers;
}

async function zidRequest(cfg: EcommerceConnectionConfig, path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${ZID_BASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(cfg), ...(init?.headers ?? {}) },
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      detail = body?.message ?? body?.error ?? detail;
    } catch {
      // response wasn't JSON — keep the status-only detail
    }
    throw AppError.internal(`Zid API error: ${detail}`);
  }

  return response.json();
}

function mapZidOrderToExternalOrder(order: Record<string, unknown>): ExternalOrder {
  const customer = (order.customer as Record<string, unknown> | undefined) ?? {};
  const items = Array.isArray(order.products) ? (order.products as Record<string, unknown>[]) : [];

  return {
    externalOrderId: String(order.id ?? order.order_id ?? ""),
    externalOrderNumber: order.order_number ? String(order.order_number) : undefined,
    customerName: typeof customer.name === "string" ? customer.name : undefined,
    customerPhone: typeof customer.mobile === "string" ? customer.mobile : undefined,
    currency: typeof order.currency === "string" ? order.currency : undefined,
    total: Number(order.total_price ?? order.total ?? 0),
    items: items.map((item) => ({
      externalProductId: String(item.product_id ?? item.id ?? ""),
      name: String(item.name ?? ""),
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.price ?? 0),
    })),
    raw: order,
  };
}

export const zidProvider: EcommerceProvider = {
  name: "zid",

  async testConnection(cfg: EcommerceConnectionConfig): Promise<{ ok: boolean; storeName?: string; message?: string }> {
    try {
      const result = (await zidRequest(cfg, "/managers/store")) as { store?: { title?: string } };
      return { ok: true, storeName: result?.store?.title };
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

    const result = (await zidRequest(
      cfg,
      product.existingExternalId ? `/products/${product.existingExternalId}` : "/products",
      { method: product.existingExternalId ? "PUT" : "POST", body },
    )) as { product?: { id?: string | number; sku?: string } };

    const externalId = product.existingExternalId ?? String(result?.product?.id ?? "");
    return { externalId, externalSku: result?.product?.sku };
  },

  async pullOrders(cfg: EcommerceConnectionConfig, since?: Date | null): Promise<ExternalOrder[]> {
    const query = since ? `?from_date=${encodeURIComponent(since.toISOString())}` : "";
    const result = (await zidRequest(cfg, `/managers/store/orders${query}`)) as { orders?: Record<string, unknown>[] };
    const orders = result?.orders ?? [];
    return orders.map(mapZidOrderToExternalOrder);
  },

  verifyWebhook(cfg: EcommerceConnectionConfig, headers: Record<string, string | string[] | undefined>, rawBody: Buffer): boolean {
    const secret = cfg.credentials.webhookSecret;
    const header = headers["x-zid-signature"];
    if (typeof header !== "string" || !header) return false;

    if (typeof secret === "string" && secret) {
      const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
      const expectedBuf = Buffer.from(expected, "hex");
      const actualBuf = Buffer.from(header, "hex");
      if (expectedBuf.length !== actualBuf.length) return false;
      try {
        return timingSafeEqual(expectedBuf, actualBuf);
      } catch {
        return false;
      }
    }

    // No webhook secret configured — fall back to comparing the manager
    // token directly (Zid stores without a dedicated webhook secret).
    const managerToken = cfg.credentials.managerToken;
    return typeof managerToken === "string" && managerToken.length > 0 && managerToken === header;
  },

  parseOrderWebhook(payload: unknown): ExternalOrder | null {
    if (!payload || typeof payload !== "object") return null;
    const envelope = payload as { event?: string; order?: Record<string, unknown> } & Record<string, unknown>;
    const orderData = envelope.order ?? (envelope as Record<string, unknown>);
    if (!orderData || typeof orderData !== "object") return null;
    try {
      return mapZidOrderToExternalOrder(orderData as Record<string, unknown>);
    } catch {
      return null;
    }
  },
};

// Implemented against Shopify's documented public Admin REST API
// (https://shopify.dev/docs/api/admin-rest) but NOT yet verified against a
// live sandbox — no merchant account was available while building this.
// Verify request/response shapes during the first real Shopify merchant
// onboarding and adjust mapping as needed.
import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../../../core/errors/AppError";
import type {
  EcommerceConnectionConfig,
  EcommerceProvider,
  ExternalOrder,
  PushProductInput,
} from "./types";

const SHOPIFY_API_VERSION = "2024-10";

function baseUrl(cfg: EcommerceConnectionConfig): string {
  const shopDomain = cfg.credentials.shopDomain;
  const domain = typeof shopDomain === "string" && shopDomain ? shopDomain : "";
  return `https://${domain}/admin/api/${SHOPIFY_API_VERSION}`;
}

function authHeaders(cfg: EcommerceConnectionConfig): Record<string, string> {
  const accessToken = cfg.credentials.accessToken;
  return {
    "X-Shopify-Access-Token": typeof accessToken === "string" ? accessToken : "",
    "content-type": "application/json",
  };
}

async function shopifyRequest(cfg: EcommerceConnectionConfig, path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${baseUrl(cfg)}${path}`, {
    ...init,
    headers: { ...authHeaders(cfg), ...(init?.headers ?? {}) },
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { errors?: unknown };
      if (body?.errors) detail = typeof body.errors === "string" ? body.errors : JSON.stringify(body.errors);
    } catch {
      // response wasn't JSON — keep the status-only detail
    }
    throw AppError.internal(`Shopify API error: ${detail}`);
  }

  return response.json();
}

function mapShopifyOrderToExternalOrder(order: Record<string, unknown>): ExternalOrder {
  const customer = (order.customer as Record<string, unknown> | undefined) ?? {};
  const lineItems = Array.isArray(order.line_items) ? (order.line_items as Record<string, unknown>[]) : [];
  const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim();

  return {
    externalOrderId: String(order.id ?? ""),
    externalOrderNumber: order.name ? String(order.name) : order.order_number ? String(order.order_number) : undefined,
    customerName: customerName || undefined,
    customerPhone: typeof order.phone === "string" ? order.phone : (typeof customer.phone === "string" ? customer.phone : undefined),
    currency: typeof order.currency === "string" ? order.currency : undefined,
    total: Number(order.total_price ?? 0),
    items: lineItems.map((item) => ({
      externalProductId: String(item.variant_id ?? item.product_id ?? ""),
      name: String(item.name ?? item.title ?? ""),
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.price ?? 0),
    })),
    raw: order,
  };
}

export const shopifyProvider: EcommerceProvider = {
  name: "shopify",

  async testConnection(cfg: EcommerceConnectionConfig): Promise<{ ok: boolean; storeName?: string; message?: string }> {
    try {
      const result = (await shopifyRequest(cfg, "/shop.json")) as { shop?: { name?: string } };
      return { ok: true, storeName: result?.shop?.name };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Unknown error" };
    }
  },

  async pushProduct(cfg: EcommerceConnectionConfig, product: PushProductInput): Promise<{ externalId: string; externalSku?: string }> {
    const body = JSON.stringify({
      product: {
        title: product.name,
        body_html: product.description ?? undefined,
        variants: [{ price: String(product.sellingPrice), sku: product.sku ?? undefined }],
      },
    });

    const result = (await shopifyRequest(
      cfg,
      product.existingExternalId ? `/products/${product.existingExternalId}.json` : "/products.json",
      { method: product.existingExternalId ? "PUT" : "POST", body },
    )) as { product?: { id?: string | number; variants?: Array<{ sku?: string }> } };

    const externalId = product.existingExternalId ?? String(result?.product?.id ?? "");
    return { externalId, externalSku: result?.product?.variants?.[0]?.sku };
  },

  async pullOrders(cfg: EcommerceConnectionConfig, since?: Date | null): Promise<ExternalOrder[]> {
    const params = new URLSearchParams({ status: "any" });
    if (since) params.set("created_at_min", since.toISOString());
    const result = (await shopifyRequest(cfg, `/orders.json?${params.toString()}`)) as { orders?: Record<string, unknown>[] };
    const orders = result?.orders ?? [];
    return orders.map(mapShopifyOrderToExternalOrder);
  },

  verifyWebhook(cfg: EcommerceConnectionConfig, headers: Record<string, string | string[] | undefined>, rawBody: Buffer): boolean {
    const secret = cfg.credentials.webhookSecret;
    const header = headers["x-shopify-hmac-sha256"];
    if (typeof secret !== "string" || !secret || typeof header !== "string" || !header) return false;

    const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
    const expectedBuf = Buffer.from(expected, "base64");
    const actualBuf = Buffer.from(header, "base64");
    if (expectedBuf.length !== actualBuf.length) return false;
    try {
      return timingSafeEqual(expectedBuf, actualBuf);
    } catch {
      return false;
    }
  },

  parseOrderWebhook(payload: unknown): ExternalOrder | null {
    if (!payload || typeof payload !== "object") return null;
    try {
      return mapShopifyOrderToExternalOrder(payload as Record<string, unknown>);
    } catch {
      return null;
    }
  },
};

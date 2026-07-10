import type { EcommerceConnection, EcommerceOrder } from "@workspace/db";
import { AppError } from "../../../core/errors/AppError";
import { recordAuditEvent } from "../../../core/logging/auditLogger";
import type { TenantContext } from "../../../shared/types/tenantContext";
import { createSale } from "../../pos/services/saleService";
import { ecommerceRepository } from "../repositories/ecommerceRepository";
import { getEcommerceProvider } from "../providers";
import type { EcommerceConnectionConfig, ExternalOrder, ExternalOrderItem, PushProductInput } from "../providers/types";

function toConfig(connection: EcommerceConnection): EcommerceConnectionConfig {
  return {
    storeUrl: connection.storeUrl,
    credentials: (connection.credentials as Record<string, unknown> | null) ?? {},
  };
}

// --- connections ---------------------------------------------------------

export interface ConnectionView {
  id: string;
  companyId: string;
  platform: string;
  status: string;
  storeUrl: string | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  hasCredentials: boolean;
}

function toConnectionView(connection: EcommerceConnection): ConnectionView {
  const credentials = connection.credentials as Record<string, unknown> | null;
  return {
    id: connection.id,
    companyId: connection.companyId,
    platform: connection.platform,
    status: connection.status,
    storeUrl: connection.storeUrl,
    lastSyncedAt: connection.lastSyncedAt,
    createdAt: connection.createdAt,
    hasCredentials: Boolean(credentials && Object.keys(credentials).length > 0),
  };
}

async function getOwnedConnection(tenant: TenantContext, connectionId: string): Promise<EcommerceConnection> {
  const connection = await ecommerceRepository.findConnectionById(tenant.companyId, connectionId);
  if (!connection) throw AppError.notFound("Connection not found");
  return connection;
}

export interface CreateConnectionInput {
  platform: string;
  storeUrl?: string;
  credentials: Record<string, unknown>;
}

export async function createConnection(tenant: TenantContext, input: CreateConnectionInput): Promise<ConnectionView> {
  const connection = await ecommerceRepository.createConnection({
    companyId: tenant.companyId,
    platform: input.platform,
    status: "disconnected",
    storeUrl: input.storeUrl ?? null,
    credentials: input.credentials,
  });
  return toConnectionView(connection);
}

export interface UpdateConnectionInput {
  storeUrl?: string;
  credentials?: Record<string, unknown>;
}

export async function updateConnection(
  tenant: TenantContext,
  connectionId: string,
  input: UpdateConnectionInput,
): Promise<ConnectionView> {
  await getOwnedConnection(tenant, connectionId);
  const updated = await ecommerceRepository.updateConnection(tenant.companyId, connectionId, {
    ...(input.storeUrl !== undefined ? { storeUrl: input.storeUrl } : {}),
    ...(input.credentials !== undefined ? { credentials: input.credentials } : {}),
  });
  if (!updated) throw AppError.notFound("Connection not found");
  return toConnectionView(updated);
}

export async function listConnections(tenant: TenantContext): Promise<ConnectionView[]> {
  const connections = await ecommerceRepository.listConnections(tenant.companyId);
  return connections.map(toConnectionView);
}

export interface TestConnectionResult {
  ok: boolean;
  storeName?: string;
  message?: string;
}

export async function testConnection(tenant: TenantContext, connectionId: string): Promise<TestConnectionResult> {
  const connection = await getOwnedConnection(tenant, connectionId);
  const provider = getEcommerceProvider(connection.platform);
  const result = await provider.testConnection(toConfig(connection));

  await ecommerceRepository.updateConnection(tenant.companyId, connectionId, {
    status: result.ok ? "connected" : "error",
  });

  return result;
}

// --- push products ---------------------------------------------------------

export interface PushProductResult {
  productId: string;
  ok: boolean;
  externalId?: string;
  error?: string;
}

export async function pushProducts(
  tenant: TenantContext,
  connectionId: string,
  productIds: string[],
): Promise<PushProductResult[]> {
  const connection = await getOwnedConnection(tenant, connectionId);
  const provider = getEcommerceProvider(connection.platform);
  const cfg = toConfig(connection);

  const products = await ecommerceRepository.findProductsByIds(tenant.companyId, productIds);
  const productMap = new Map(products.map((product) => [product.id, product]));

  const results: PushProductResult[] = [];

  for (const productId of productIds) {
    const product = productMap.get(productId);
    if (!product) throw AppError.notFound(`Product ${productId} not found`);

    const existingMapping = await ecommerceRepository.findMapping(connectionId, productId);
    const input: PushProductInput = {
      id: product.id,
      name: product.name,
      sku: product.sku,
      sellingPrice: product.sellingPrice,
      description: product.description,
      existingExternalId: existingMapping?.externalId,
    };

    try {
      const pushed = await provider.pushProduct(cfg, input);
      await ecommerceRepository.upsertMapping({
        companyId: tenant.companyId,
        productId,
        connectionId,
        externalId: pushed.externalId,
        externalSku: pushed.externalSku ?? null,
        syncStatus: "synced",
        lastSyncedAt: new Date(),
      });
      results.push({ productId, ok: true, externalId: pushed.externalId });
    } catch (err) {
      if (existingMapping) {
        await ecommerceRepository.markMappingError(tenant.companyId, connectionId, productId);
      }
      const message = err instanceof Error ? err.message : "Unknown provider error";
      results.push({ productId, ok: false, error: message });
    }
  }

  return results;
}

export async function listMappings(
  tenant: TenantContext,
  connectionId: string,
  filters: { page: number; pageSize: number },
) {
  await getOwnedConnection(tenant, connectionId);
  return ecommerceRepository.listMappings(tenant.companyId, connectionId, filters);
}

// --- pull orders -------------------------------------------------------------

export interface PullOrdersResult {
  pulled: number;
  staged: number;
  duplicates: number;
}

export async function pullOrders(tenant: TenantContext, connectionId: string): Promise<PullOrdersResult> {
  const connection = await getOwnedConnection(tenant, connectionId);
  const provider = getEcommerceProvider(connection.platform);
  const cfg = toConfig(connection);

  const externalOrders = await provider.pullOrders(cfg, connection.lastSyncedAt);

  let staged = 0;
  let duplicates = 0;

  for (const order of externalOrders) {
    const inserted = await ecommerceRepository.insertOrderIfNew({
      companyId: tenant.companyId,
      connectionId,
      externalOrderId: order.externalOrderId,
      externalOrderNumber: order.externalOrderNumber ?? null,
      customerName: order.customerName ?? null,
      customerPhone: order.customerPhone ?? null,
      total: String(order.total),
      currency: order.currency ?? "SAR",
      status: "received",
      // Store the normalized ExternalOrder shape (not the provider-raw
      // payload) so importOrder never has to re-parse a provider-specific
      // format — the provider-raw payload is nested under payload.raw.
      payload: order,
    });
    if (inserted) staged++;
    else duplicates++;
  }

  await ecommerceRepository.updateConnection(tenant.companyId, connectionId, { lastSyncedAt: new Date() });

  return { pulled: externalOrders.length, staged, duplicates };
}

// --- webhook staging ---------------------------------------------------------

export interface StageWebhookResult {
  duplicate: boolean;
}

// Deliberately does NOT check subscription/module state (requireModule):
// staging a webhook order is passive record-keeping, not a billable feature
// action, and the request is unauthenticated so there is no req.tenant to
// resolve a subscription against in the first place. Enforcement happens
// later, at import time, via the authenticated route pipeline.
export async function stageWebhookOrder(
  connectionId: string,
  headers: Record<string, string | string[] | undefined>,
  rawBody: Buffer,
  body: unknown,
): Promise<StageWebhookResult> {
  const connection = await ecommerceRepository.findConnectionByIdUnscoped(connectionId);
  if (!connection) throw AppError.notFound("Connection not found");

  const provider = getEcommerceProvider(connection.platform);
  const cfg = toConfig(connection);

  if (!provider.verifyWebhook(cfg, headers, rawBody)) {
    throw AppError.unauthorized("invalid webhook signature");
  }

  const order = provider.parseOrderWebhook(body);
  if (!order) throw AppError.validation("Invalid webhook order payload");

  const inserted = await ecommerceRepository.insertOrderIfNew({
    companyId: connection.companyId,
    connectionId,
    externalOrderId: order.externalOrderId,
    externalOrderNumber: order.externalOrderNumber ?? null,
    customerName: order.customerName ?? null,
    customerPhone: order.customerPhone ?? null,
    total: String(order.total),
    currency: order.currency ?? "SAR",
    status: "received",
    payload: order,
  });

  return { duplicate: !inserted };
}

// --- orders list / import / ignore -------------------------------------------

export async function listOrders(
  tenant: TenantContext,
  filters: { page: number; pageSize: number; status?: string; connectionId?: string },
) {
  return ecommerceRepository.listOrders(tenant.companyId, filters);
}

async function getOwnedOrder(tenant: TenantContext, orderId: string): Promise<EcommerceOrder> {
  const order = await ecommerceRepository.findOrderById(tenant.companyId, orderId);
  if (!order) throw AppError.notFound("Order not found");
  return order;
}

export async function getOrder(tenant: TenantContext, orderId: string): Promise<EcommerceOrder> {
  return getOwnedOrder(tenant, orderId);
}

export async function importOrder(
  tenant: TenantContext,
  orderId: string,
  paymentMethodId: string,
): Promise<{ saleId: string; total: string }> {
  // Conditional claim (status -> "importing") instead of read-then-check:
  // concurrent import attempts (double-click, retried request) are made
  // mutually exclusive by the UPDATE's status filter, so two racers can't
  // both reach createSale and deduct stock twice. Every path out of this
  // function moves the claim on to "imported" or "failed".
  const order = await ecommerceRepository.claimOrderForImport(tenant.companyId, orderId);
  if (!order) {
    const existing = await getOwnedOrder(tenant, orderId);
    throw AppError.conflict(`Order cannot be imported from status "${existing.status}"`);
  }

  const payload = order.payload as ExternalOrder;
  const items = (payload?.items ?? []) as ExternalOrderItem[];

  const mappings = await ecommerceRepository.findMappingsByConnection(tenant.companyId, order.connectionId);
  const productIdByExternalId = new Map(mappings.map((mapping) => [mapping.externalId, mapping.productId]));

  const unmapped: string[] = [];
  const resolvedItems = items.map((item) => {
    const productId = productIdByExternalId.get(item.externalProductId);
    if (!productId) unmapped.push(item.externalProductId);
    return { ...item, productId };
  });

  if (unmapped.length > 0) {
    const message = `Unmapped external products: ${unmapped.join(", ")}`;
    await ecommerceRepository.updateOrderStatus(tenant.companyId, orderId, {
      status: "failed",
      errorMessage: message,
    });
    throw AppError.validation(message);
  }

  const computedTotalCents = resolvedItems.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPrice * 100),
    0,
  );
  const computedTotal = computedTotalCents / 100;
  const stagedTotal = Number(order.total);

  let notes = `E-commerce order import: ${payload?.externalOrderNumber ?? payload?.externalOrderId ?? order.externalOrderId}`;
  if (Math.abs(computedTotal - stagedTotal) > 0.005) {
    const diff = (stagedTotal - computedTotal).toFixed(2);
    notes += ` (order total ${stagedTotal} includes ${diff} difference — shipping/fees not modeled)`;
  }

  try {
    const sale = await createSale(tenant, {
      items: resolvedItems.map((item) => ({
        productId: item.productId as string,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      payments: [{ paymentMethodId, amount: computedTotal }],
      notes,
    });

    await ecommerceRepository.updateOrderStatus(tenant.companyId, orderId, {
      status: "imported",
      saleId: sale.id,
      importedAt: new Date(),
      errorMessage: null,
    });

    recordAuditEvent(tenant, {
      action: "import_ecommerce_order",
      entityType: "ecommerce_order",
      entityId: orderId,
      details: { saleId: sale.id, total: sale.total },
    });

    return { saleId: sale.id, total: sale.total };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error creating sale";
    await ecommerceRepository.updateOrderStatus(tenant.companyId, orderId, {
      status: "failed",
      errorMessage: message,
    });
    throw err;
  }
}

export async function ignoreOrder(tenant: TenantContext, orderId: string): Promise<EcommerceOrder> {
  const order = await getOwnedOrder(tenant, orderId);
  if (order.status !== "received" && order.status !== "failed") {
    throw AppError.conflict(`Order cannot be ignored from status "${order.status}"`);
  }
  const updated = await ecommerceRepository.updateOrderStatus(tenant.companyId, orderId, { status: "ignored" });
  if (!updated) throw AppError.notFound("Order not found");
  return updated;
}

// Provider-agnostic e-commerce channel contract. Every backend (real
// platform or mock) implements this shape so ecommerceService never
// branches on platform name.

export interface EcommerceConnectionConfig {
  storeUrl?: string | null;
  credentials: Record<string, unknown>;
}

export interface ExternalOrderItem {
  externalProductId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface ExternalOrder {
  externalOrderId: string;
  externalOrderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  currency?: string;
  total: number;
  items: ExternalOrderItem[];
  raw: unknown;
}

export interface PushProductInput {
  id: string;
  name: string;
  sku?: string | null;
  sellingPrice: string | number;
  description?: string | null;
  existingExternalId?: string;
}

export interface EcommerceProvider {
  readonly name: string;
  testConnection(cfg: EcommerceConnectionConfig): Promise<{ ok: boolean; storeName?: string; message?: string }>;
  pushProduct(cfg: EcommerceConnectionConfig, product: PushProductInput): Promise<{ externalId: string; externalSku?: string }>;
  pullOrders(cfg: EcommerceConnectionConfig, since?: Date | null): Promise<ExternalOrder[]>;
  verifyWebhook(cfg: EcommerceConnectionConfig, headers: Record<string, string | string[] | undefined>, rawBody: Buffer): boolean;
  parseOrderWebhook(payload: unknown): ExternalOrder | null;
}

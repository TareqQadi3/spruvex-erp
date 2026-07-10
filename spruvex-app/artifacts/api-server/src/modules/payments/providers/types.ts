// Provider-agnostic payment gateway contract. Every backend (real gateway or
// mock) implements this shape so paymentsService never branches on provider
// name for the checkout/status/refund/webhook lifecycle.

export type PaymentStatus = "pending" | "captured" | "failed" | "cancelled" | "refunded";

export interface PaymentGatewayConfig {
  credentials: Record<string, unknown>;
  mode: "test" | "live";
}

export interface CreateCheckoutInput {
  amount: number;
  currency: string;
  description: string;
  reference: string;
  customerName?: string;
  customerPhone?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(
    cfg: PaymentGatewayConfig,
    input: CreateCheckoutInput,
  ): Promise<{ externalId: string; checkoutUrl?: string; status: PaymentStatus }>;
  getStatus(cfg: PaymentGatewayConfig, externalId: string): Promise<PaymentStatus>;
  refund(cfg: PaymentGatewayConfig, externalId: string, amount: number): Promise<{ status: PaymentStatus }>;
  verifyWebhook(cfg: PaymentGatewayConfig, headers: Record<string, string | string[] | undefined>, rawBody: Buffer): boolean;
  parseWebhook(payload: unknown): { externalId: string; status: PaymentStatus } | null;
}

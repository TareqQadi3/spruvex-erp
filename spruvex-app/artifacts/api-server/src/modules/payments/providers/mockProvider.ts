import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import type { CreateCheckoutInput, PaymentGatewayConfig, PaymentProvider, PaymentStatus } from "./types";

// Deterministic, no-network provider: lets dev/tests run without a merchant
// account and proves paymentsService is not hard-wired to one vendor — same
// convention as modules/ai's mockProvider.
export const mockProvider: PaymentProvider = {
  name: "mock",

  async createCheckout(
    _cfg: PaymentGatewayConfig,
    _input: CreateCheckoutInput,
  ): Promise<{ externalId: string; checkoutUrl?: string; status: PaymentStatus }> {
    const externalId = `mockpay_${randomUUID()}`;
    return {
      externalId,
      checkoutUrl: `https://pay.mock.local/checkout/${externalId}`,
      status: "pending",
    };
  },

  async getStatus(_cfg: PaymentGatewayConfig, _externalId: string): Promise<PaymentStatus> {
    return "pending";
  },

  async refund(_cfg: PaymentGatewayConfig, _externalId: string, _amount: number): Promise<{ status: PaymentStatus }> {
    return { status: "refunded" };
  },

  verifyWebhook(
    cfg: PaymentGatewayConfig,
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): boolean {
    const secret = cfg.credentials.webhookSecret;
    const header = headers["x-mock-signature"];
    if (typeof secret !== "string" || !secret || typeof header !== "string" || !header) return false;

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const expectedBuf = Buffer.from(expected, "utf8");
    const headerBuf = Buffer.from(header, "utf8");
    if (expectedBuf.length !== headerBuf.length) return false;
    return timingSafeEqual(expectedBuf, headerBuf);
  },

  parseWebhook(payload: unknown): { externalId: string; status: PaymentStatus } | null {
    if (!payload || typeof payload !== "object") return null;
    const body = payload as Record<string, unknown>;
    const externalId = body.externalId;
    const status = body.status;
    const validStatuses: PaymentStatus[] = ["pending", "captured", "failed", "cancelled", "refunded"];
    if (typeof externalId !== "string" || typeof status !== "string") return null;
    if (!validStatuses.includes(status as PaymentStatus)) return null;
    return { externalId, status: status as PaymentStatus };
  },
};

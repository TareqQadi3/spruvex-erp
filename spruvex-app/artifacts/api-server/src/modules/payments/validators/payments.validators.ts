import { z } from "zod/v4";
import { PAYMENT_PROVIDERS } from "@workspace/db";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../../config/constants";

export const upsertGatewaySchema = z.object({
  credentials: z.record(z.string(), z.unknown()).optional(),
  mode: z.enum(["test", "live"]).optional(),
  isActive: z.boolean().optional(),
});

export const createCheckoutSchema = z.object({
  provider: z.enum(PAYMENT_PROVIDERS),
  source: z.enum(["sale", "ecommerce_order"]),
  sourceId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(100).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export const refundSchema = z.object({
  amount: z.number().positive().optional(),
});

// Built directly with zod/v4 rather than extending the shared (zod v3)
// paginationQuerySchema — mixing the two Zod major-version instances across
// a .extend() call is not type-compatible, so pagination fields are
// duplicated here instead (same convention/defaults as common.validators).
export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  provider: z.enum(PAYMENT_PROVIDERS).optional(),
  status: z.enum(["created", "pending", "captured", "failed", "cancelled", "refunded"]).optional(),
  source: z.enum(["sale", "ecommerce_order"]).optional(),
});

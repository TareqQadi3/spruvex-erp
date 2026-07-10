import { z } from "zod/v4";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../../config/constants";

export const ECOMMERCE_PLATFORMS = ["salla", "zid", "shopify", "mock"] as const;

export const createConnectionSchema = z.object({
  platform: z.enum(ECOMMERCE_PLATFORMS),
  storeUrl: z.string().url().optional(),
  credentials: z.record(z.string(), z.unknown()),
});

export const updateConnectionSchema = z.object({
  storeUrl: z.string().url().optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
});

export const pushProductsSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1).max(50),
});

export const importOrderSchema = z.object({
  paymentMethodId: z.string().uuid(),
});

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  status: z.enum(["received", "imported", "failed", "ignored"]).optional(),
  connectionId: z.string().uuid().optional(),
});

export const listMappingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

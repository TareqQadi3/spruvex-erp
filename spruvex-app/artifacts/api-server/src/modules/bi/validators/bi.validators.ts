import { z } from "zod";

// from/to are optional ISO date strings; when omitted the route handler
// defaults to the last 30 days ending now (per the "caller controls the
// range" rule — no date defaulting lives in the service/repository).
export const biDateRangeQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const biLowStockQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

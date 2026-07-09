import { z } from "zod";

const offlineOperationSchema = z.object({
  clientGeneratedId: z.string().uuid(),
  entityType: z.string().trim().min(1),
  operationType: z.enum(["create", "update", "delete", "adjust_stock", "create_sale", "create_payment"]),
  payload: z.record(z.string(), z.unknown()),
});

export const syncPushSchema = z.object({
  deviceId: z.string().trim().min(1),
  branchId: z.string().uuid().optional(),
  operations: z.array(offlineOperationSchema).min(1),
});

export const syncPullQuerySchema = z.object({
  deviceId: z.string().trim().min(1),
  branchId: z.string().uuid().optional(),
  since: z.string().datetime().optional(),
});

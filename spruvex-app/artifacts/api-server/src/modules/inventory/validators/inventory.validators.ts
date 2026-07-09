import { z } from "zod";

export const getStockQuerySchema = z.object({
  warehouseId: z.string().uuid().optional(),
});

export const adjustStockSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantityDelta: z.number().int().refine((v) => v !== 0, "quantityDelta must not be zero"),
  reason: z.string().trim().min(1).max(500),
});

export const transferStockSchema = z
  .object({
    productId: z.string().uuid(),
    fromWarehouseId: z.string().uuid(),
    toWarehouseId: z.string().uuid(),
    quantity: z.number().int().positive(),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    message: "fromWarehouseId and toWarehouseId must differ",
    path: ["toWarehouseId"],
  });

export const reserveStockSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  quantity: z.number().int().positive(),
  referenceType: z.string().trim().min(1).max(50),
  referenceId: z.string().uuid().optional(),
});

export const commitStockDeductionSchema = reserveStockSchema;

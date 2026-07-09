import { z } from "zod";

const saleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
});

const salePaymentSchema = z.object({
  paymentMethodId: z.string().uuid(),
  amount: z.number().positive(),
});

export const createSaleSchema = z.object({
  customerId: z.string().uuid().optional(),
  cashSessionId: z.string().uuid().optional(),
  items: z.array(saleItemSchema).min(1),
  payments: z.array(salePaymentSchema).min(1),
  discount: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
});

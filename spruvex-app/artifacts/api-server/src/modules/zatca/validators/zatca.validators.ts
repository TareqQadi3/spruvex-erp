import { z } from "zod";

export const createInvoiceFromSaleSchema = z.object({
  saleId: z.string().uuid(),
  buyerName: z.string().trim().min(1).max(200).optional(),
  buyerVatNumber: z.string().trim().min(1).max(50).optional(),
});

export const submitToZatcaSchema = z.object({
  mode: z.enum(["compliance_check", "reporting", "clearance"]),
});

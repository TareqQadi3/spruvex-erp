import { z } from "zod";
import { INVOICE_TEMPLATE_KINDS, INVOICE_TEMPLATE_PRINT_TYPES } from "@workspace/db";

const templateConfigSchema = z.object({
  showLogo: z.boolean().optional(),
  headerText: z.string().nullable().optional(),
  footerText: z.string().nullable().optional(),
  language: z.enum(["ar", "en"]).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "accentColor must be a hex color like #1a56db")
    .optional(),
  showBuyerInfo: z.boolean().optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1),
  documentKind: z.enum(INVOICE_TEMPLATE_KINDS),
  printType: z.enum(INVOICE_TEMPLATE_PRINT_TYPES),
  isDefault: z.boolean().optional(),
  config: templateConfigSchema.optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const printQuerySchema = z.object({
  printType: z.enum(INVOICE_TEMPLATE_PRINT_TYPES).default("a4"),
  templateId: z.string().uuid().optional(),
});

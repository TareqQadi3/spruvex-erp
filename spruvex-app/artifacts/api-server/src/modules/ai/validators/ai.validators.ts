import { z } from "zod";
import { AI_PROVIDERS } from "@workspace/db";
import { paginationQuerySchema } from "../../../shared/validators/common.validators";

export const PRODUCT_ASSISTANT_ACTIONS = [
  "describe",
  "improve_name",
  "suggest_category",
  "suggest_keywords",
  "ecommerce_description",
] as const;

export const languageSchema = z.enum(["ar", "en"]).default("ar");

export const updateSettingsSchema = z.object({
  provider: z.enum(AI_PROVIDERS).optional(),
  model: z.string().nullable().optional(),
  apiKey: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const productAssistantSchema = z.object({
  action: z.enum(PRODUCT_ASSISTANT_ACTIONS),
  name: z.string().min(1),
  category: z.string().optional(),
  brand: z.string().optional(),
  description: z.string().optional(),
  keywords: z.string().optional(),
  language: languageSchema,
});

export const businessSummarySchema = z.object({
  language: languageSchema,
});

export const listUsageQuerySchema = paginationQuerySchema;

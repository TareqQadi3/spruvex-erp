import { z } from "zod";
import { ADDON_CODES, PLAN_CODES } from "@workspace/db";

export const changePlanSchema = z.object({
  plan: z.enum(PLAN_CODES),
});

export const changeStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
});

export const addonParamsSchema = z.object({
  addonCode: z.enum(ADDON_CODES),
});

export const upsertAddonSchema = z.object({
  isActive: z.boolean(),
  quantity: z.number().int().min(0).optional(),
});

export const renewSubscriptionSchema = z.object({
  periodDays: z.number().int().min(1).max(365).default(30),
});

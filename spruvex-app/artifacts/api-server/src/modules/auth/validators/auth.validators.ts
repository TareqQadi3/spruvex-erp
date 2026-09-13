import { z } from "zod";

export const requestOtpSchema = z.object({
  email: z.string().trim().email(),
});

export const checkOtpSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().regex(/^\d{6}$/, "OTP must be a 6-digit code"),
});

export const registerCompanySchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  adminUsername: z.string().trim().min(3).max(50),
  adminEmail: z.string().trim().email(),
  adminPassword: z.string().min(8).max(200),
  businessType: z.enum([
    "retail", "electronics", "repair", "restaurant", "ecommerce",
    "grocery", "cafe", "clothing", "mobile_repair", "contracting",
    "pharmacy", "salon_beauty", "other",
  ]),
  plan: z.enum(["erp_business", "restaurant", "sales_repair", "enterprise"]),
  otp: z.string().trim().regex(/^\d{6}$/, "OTP must be a 6-digit code"),
  // T-15 — optional affiliate referral code carried through from the
  // marketing site's signup link (e.g. ?ref=CODE). Reporting the resulting
  // conversion is best-effort and never blocks registration — see
  // authService.registerCompany.
  referralCode: z.string().trim().max(50).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().regex(/^\d{6}$/, "OTP must be a 6-digit code"),
  newPassword: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// Same flat role set the Users settings page assigns from (ROLES in
// users.tsx) — every value here is also a seeded DEFAULT_ROLES name, so
// inviteService can assign it directly via findGlobalRoleByName without a
// translation step.
export const INVITABLE_ROLES = ["admin", "store_manager", "cashier", "warehouse_staff", "accountant"] as const;

export const createInviteSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(INVITABLE_ROLES),
});

export const acceptInviteSchema = z.object({
  token: z.string().trim().min(1),
  username: z.string().trim().min(3).max(50),
  password: z.string().min(8).max(200),
});

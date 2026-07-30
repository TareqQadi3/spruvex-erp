import { z } from "zod";

export const requestOtpSchema = z.object({
  email: z.string().trim().email(),
});

export const registerCompanySchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  adminUsername: z.string().trim().min(3).max(50),
  adminEmail: z.string().trim().email(),
  adminPassword: z.string().min(8).max(200),
  businessType: z.enum(["retail", "electronics", "repair", "restaurant", "ecommerce"]),
  plan: z.enum(["erp_business", "restaurant", "sales_repair", "enterprise"]),
  otp: z.string().trim().regex(/^\d{6}$/, "OTP must be a 6-digit code"),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type BusinessType =
  | "retail"
  | "electronics"
  | "repair"
  | "restaurant"
  | "ecommerce"
  | "grocery"
  | "cafe"
  | "clothing"
  // Phones-and-repair-in-one-shop is how this activity is actually run and
  // named in this market — distinct from picking "electronics" and then
  // separately discovering/enabling the repairs module afterward.
  | "mobile_repair"
  // Project/service-based (site work, supply-and-install, no cash-register
  // point of sale) — needs isService-heavy defaults, not a retail POS screen.
  | "contracting"
  | "pharmacy"
  | "salon_beauty"
  | "other";
export type CompanyPlan = "erp_business" | "restaurant" | "sales_repair" | "enterprise";

export interface RegisterCompanyInput {
  companyName: string;
  adminUsername: string;
  adminEmail: string;
  adminPassword: string;
  businessType: BusinessType;
  plan: CompanyPlan;
  otp: string;
  referralCode?: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string | null;
  companyId: string;
  role: string;
  permissions: string[];
}

export interface AuthResult {
  user: AuthenticatedUser;
  tokens: AuthTokens;
  // Only populated by registerCompany — lets the signup wizard render the
  // "here's what you got" summary without a follow-up /settings call.
  branchId?: string;
  enabledModules?: string[];
}

export type BusinessType = "retail" | "electronics" | "repair" | "restaurant" | "ecommerce";
export type CompanyPlan = "erp_business" | "restaurant" | "sales_repair" | "enterprise";

export interface RegisterCompanyInput {
  companyName: string;
  adminUsername: string;
  adminEmail?: string;
  adminPassword: string;
  businessType: BusinessType;
  plan: CompanyPlan;
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

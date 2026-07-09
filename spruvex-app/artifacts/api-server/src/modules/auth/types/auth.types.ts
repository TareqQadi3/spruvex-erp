export interface RegisterCompanyInput {
  companyName: string;
  adminUsername: string;
  adminEmail?: string;
  adminPassword: string;
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
}

import bcrypt from "bcryptjs";
import { db } from "../../../core/database/connection";
import { withTransaction, type DbOrTx } from "../../../core/database/transaction";
import { AppError } from "../../../core/errors/AppError";
import { recordAuditEvent } from "../../../core/logging/auditLogger";
import type { TenantContext } from "../../../shared/types/tenantContext";
import { permissionResolver } from "../../rbac/services/permissionResolverService";
import { ensureSeeded as ensureChartOfAccountsSeeded } from "../../accounting";
import { UserAuthRepository } from "../repositories/userAuthRepository";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./tokenService";
import { resolveBusinessTypeDefaults } from "./businessTypeDefaults";
import type { AuthResult, LoginInput, RegisterCompanyInput } from "../types/auth.types";

const TRIAL_PERIOD_DAYS = 14;
const DEFAULT_BRANCH_NAME = "الفرع الرئيسي";
const DEFAULT_WAREHOUSE_NAME = "المستودع الرئيسي";

// Exported so scripts/seedPlatformAdmin.ts (the only other place that ever
// creates a password hash outside this service) reuses the same cost factor
// instead of redefining it.
export const BCRYPT_ROUNDS = 12;
const ADMIN_ROLE_NAME = "admin";

const repo = new UserAuthRepository();

// No permissions resolved here — TenantContext is identity only. Requests
// authorize via core/middleware/permission.middleware's live DB resolution.
async function buildTenantContext(companyId: string, userId: string, client: DbOrTx = db): Promise<TenantContext> {
  const roleName = await repo.getUserPrimaryRoleName(companyId, userId, client);
  return { userId, companyId, role: roleName ?? "member" };
}

// Permissions shown here are informational only (so a client can render its
// UI without a follow-up call) — resolved via the same PermissionResolver
// every authorization check uses, not a separate/duplicated query. Takes the
// same `client` as the caller (registerCompany passes its `tx`) so this reads
// role assignments made earlier in the same not-yet-committed transaction.
async function toAuthResult(
  user: { id: string; username: string; email: string | null },
  tenant: TenantContext,
  client: DbOrTx = db,
): Promise<AuthResult> {
  const permissions = await permissionResolver.resolve(tenant.companyId, tenant.userId, tenant.branchId, client);
  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      companyId: tenant.companyId,
      role: tenant.role,
      permissions,
    },
    tokens: {
      accessToken: signAccessToken(tenant),
      refreshToken: signRefreshToken(tenant.userId, tenant.companyId),
    },
  };
}

export async function registerCompany(input: RegisterCompanyInput): Promise<AuthResult> {
  const existing = await repo.findUserByUsername(input.adminUsername);
  if (existing) throw AppError.conflict("Username is already taken");

  const passwordHash = await bcrypt.hash(input.adminPassword, BCRYPT_ROUNDS);
  const moduleDefaults = resolveBusinessTypeDefaults(input.businessType);
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  return withTransaction(async (tx) => {
    const company = await repo.createCompany(input.companyName, tx);
    await repo.setCompanyOnboardingFields(
      company.id,
      {
        plan: input.plan,
        businessType: input.businessType,
        enabledModules: JSON.stringify(moduleDefaults.enabledModules),
        trialEndsAt,
      },
      tx,
    );

    const user = await repo.createUser(
      {
        companyId: company.id,
        username: input.adminUsername,
        email: input.adminEmail,
        passwordHash,
        role: ADMIN_ROLE_NAME,
      },
      tx,
    );

    const adminRole = await repo.findGlobalRoleByName(ADMIN_ROLE_NAME, tx);
    if (!adminRole) throw AppError.internal("Default 'admin' role is not seeded");
    await repo.assignUserRole({ companyId: company.id, userId: user.id, roleId: adminRole.id }, tx);

    const branch = await repo.createBranch(
      { companyId: company.id, name: DEFAULT_BRANCH_NAME, isDefault: true, isActive: true },
      tx,
    );

    // Every tenant needs a default warehouse before its first sale can go
    // through the inventory engine (resolveWarehouseId falls back to it when
    // no warehouseId is given) — without this, a fresh company's first POS
    // sale fails with "No default warehouse configured for this company".
    await repo.createWarehouse(
      { companyId: company.id, name: DEFAULT_WAREHOUSE_NAME, isDefault: true, isRepairStock: false },
      tx,
    );

    // Same defaults as the legacy route's seedOrgDefaults() (settings, payment
    // methods, chart of accounts) plus the module-gating flags this business
    // type gets — see businessTypeDefaults.ts.
    await repo.createSettings(
      {
        companyId: company.id,
        shopName: input.companyName,
        currency: "SAR",
        repairsModuleEnabled: moduleDefaults.repairsModuleEnabled,
        ecommerceModuleEnabled: moduleDefaults.ecommerceModuleEnabled,
      },
      tx,
    );
    await repo.createDefaultPaymentMethods(company.id, tx);
    await ensureChartOfAccountsSeeded(tx, company.id);

    await repo.createSubscription(
      {
        companyId: company.id,
        plan: input.plan,
        status: "trialing",
        billingCycle: "monthly",
        price: "0",
        currency: "SAR",
        trialEndsAt,
        currentPeriodStart: now,
      },
      tx,
    );

    const tenant = await buildTenantContext(company.id, user.id, tx);
    recordAuditEvent(tenant, { action: "register_company", entityType: "company", entityId: company.id });
    const result = await toAuthResult(user, tenant, tx);
    return { ...result, branchId: branch.id, enabledModules: moduleDefaults.enabledModules };
  });
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await repo.findUserByUsername(input.username);
  if (!user || !user.isActive) throw AppError.unauthorized("Invalid username or password");

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw AppError.unauthorized("Invalid username or password");

  const tenant = await buildTenantContext(user.companyId, user.id);
  recordAuditEvent(tenant, { action: "login", entityType: "user", entityId: user.id });
  return toAuthResult(user, tenant);
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  let decoded: { userId: string; companyId: string };
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthorized("Invalid or expired refresh token");
  }

  const user = await repo.findUserById(decoded.userId);
  if (!user || !user.isActive || user.companyId !== decoded.companyId) {
    throw AppError.unauthorized("Invalid or expired refresh token");
  }

  // Re-resolves permissions from the DB on every refresh, so a role change
  // is picked up at the next refresh instead of only at the next full login.
  const tenant = await buildTenantContext(user.companyId, user.id);
  return toAuthResult(user, tenant);
}

export async function getCurrentUser(tenant: TenantContext): Promise<AuthResult["user"]> {
  const user = await repo.findUserById(tenant.userId);
  if (!user || user.companyId !== tenant.companyId) throw AppError.notFound("User not found");
  const permissions = await permissionResolver.resolve(tenant.companyId, tenant.userId, tenant.branchId);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    companyId: tenant.companyId,
    role: tenant.role,
    permissions,
  };
}

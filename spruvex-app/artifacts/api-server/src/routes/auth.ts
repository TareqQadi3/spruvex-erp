import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable, companiesTable, settingsTable, paymentMethodsTable, branchesTable, warehousesTable, subscriptionsTable, PERMISSIONS } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { JWT_SECRET } from "../lib/jwt-secret";
import { requireAuth, requireRole, type AuthedRequest } from "../lib/auth-middleware";
import { ensureSeeded as ensureChartOfAccountsSeeded } from "../modules/accounting";
// requireAuth from lib/auth-middleware only populates req.user, not
// req.tenant — requireWithinLimit needs req.tenant (see
// core/middleware/subscription.middleware.ts). Both legacy and modular
// tokens carry `sub`/`companyId`/`role` (legacy signs `sub` as an alias of
// `id` specifically so modular auth.middleware can decode it), so chaining
// the modular requireAuth alongside the legacy one just re-derives the same
// identity into req.tenant without changing legacy behavior.
import { requireAuth as requireAuthModular } from "../core/middleware/auth.middleware";
import { requireWithinLimit } from "../core/middleware/subscription.middleware";
import { countCurrentUsersForCompany } from "../modules/subscriptions/services/planLimitsService";
import { rateLimitAuth } from "../core/middleware/rateLimit.middleware";
import { logAudit } from "../modules/auditLog/auditLogService";
import { syncUserRoleFromLegacy, ensureUserRoleAssigned } from "../modules/rbac/services/userRoleSyncService";
import { permissionResolver } from "../modules/rbac/services/permissionResolverService";
import { listUserBranches, isUserAllowedBranch } from "../modules/branches/branchService";

const router = Router();
const JWT_EXPIRES = "7d";

async function seedOrgDefaults(companyId: string, shopName: string) {
  await db.insert(settingsTable).values({ companyId, shopName, currency: "SAR" });
  await db.insert(paymentMethodsTable).values([
    { companyId, name: "Cash", percentFee: "0", fixedFee: "0" },
    { companyId, name: "Mada", percentFee: "0", fixedFee: "0" },
    { companyId, name: "Visa/Mastercard", percentFee: "2", fixedFee: "0" },
  ]);
  await ensureChartOfAccountsSeeded(db, companyId);

  // Same gap the modular register-company flow already closed (Phase 10):
  // without a default branch/warehouse, the first POS sale on this legacy
  // signup path fails or silently lands with no branch context, and without
  // a subscription row every plan-limited endpoint (branches, users, ...)
  // reads as "inactive" and 403s outright.
  await db.insert(branchesTable).values({ companyId, name: "الفرع الرئيسي", isDefault: true, isActive: true });
  await db.insert(warehousesTable).values({ companyId, name: "المستودع الرئيسي", isDefault: true, isRepairStock: false });
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  await db.insert(subscriptionsTable).values({
    companyId, plan: "erp_business", status: "trial", billingCycle: "monthly",
    price: "0", currency: "SAR", trialEndsAt, currentPeriodStart: now,
  });
}


// Creates a brand new tenant (Company) with its first admin user — the SaaS signup flow.
router.post("/register", rateLimitAuth, async (req, res) => {
  const { organizationName, username, password } = req.body;
  if (!organizationName || !username || !password) {
    res.status(400).json({ error: "organizationName, username and password are required" });
    return;
  }

  const [existingUser] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(eq(usersTable.username, username.trim())).limit(1);
  if (existingUser) {
    res.status(409).json({ error: "Username is already taken" });
    return;
  }

  const [org] = await db.insert(companiesTable).values({ name: organizationName.trim() }).returning();
  await seedOrgDefaults(org.id, organizationName.trim());

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    companyId: org.id,
    username: username.trim(),
    role: "admin",
    passwordHash,
    isActive: true,
  }).returning();

  await syncUserRoleFromLegacy(org.id, user.id, user.role);

  const payload = { id: user.id, username: user.username, role: user.role, companyId: org.id };
  // sub mirrors id so this token is also accepted by the modular routers'
  // auth middleware (core/middleware/auth.middleware.ts), which reads sub.
  const token = jwt.sign({ ...payload, sub: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.status(201).json({ token, user: payload });
});

router.post("/login", rateLimitAuth, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username.trim()))
    .limit(1);

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  // Only pre-select a branch in the token when there's exactly one real
  // choice — a multi-branch user must explicitly pick via
  // POST /auth/select-branch (see below) before any branch-scoped action
  // (sale, warehouse view, branch-filtered report) will resolve correctly.
  const branches = await listUserBranches(user.companyId, user.id);
  const branchId = branches.length === 1 ? branches[0].id : undefined;

  const payload = { id: user.id, username: user.username, role: user.role, companyId: user.companyId, branchId };
  // sub mirrors id so this token is also accepted by the modular routers'
  // auth middleware (core/middleware/auth.middleware.ts), which reads sub.
  const token = jwt.sign({ ...payload, sub: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  await logAudit({ companyId: user.companyId, userId: user.id, action: "login", entityType: "user", entityId: user.id });

  res.json({
    token,
    user: payload,
    branches,
  });
});

router.get("/me/branches", requireAuth, async (req: AuthedRequest, res) => {
  res.json(await listUserBranches(req.user!.companyId, req.user!.id));
});

router.post("/select-branch", requireAuth, async (req: AuthedRequest, res) => {
  const { branchId } = req.body;
  if (!branchId) {
    res.status(400).json({ error: "branchId is required" });
    return;
  }
  const allowed = await isUserAllowedBranch(req.user!.companyId, req.user!.id, branchId);
  if (!allowed) {
    res.status(403).json({ error: "Not a member of this branch" });
    return;
  }
  const payload = { id: req.user!.id, username: req.user!.username, role: req.user!.role, companyId: req.user!.companyId, branchId };
  const token = jwt.sign({ ...payload, sub: req.user!.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, user: payload });
});

// Modular-token sessions (register-company) carry no `username` claim, so the
// JWT alone can't answer /me — look the row up so a page refresh never shows
// a blank username until the next full login. Keeps `branchId` from the token
// so the branch pre-selection semantics stay identical to before.
router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      role: usersTable.role,
      companyId: usersTable.companyId,
    })
    .from(usersTable)
    .where(and(eq(usersTable.id, req.user!.id), eq(usersTable.companyId, req.user!.companyId)))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: { ...user, branchId: req.user!.branchId } });
});

router.get("/me/permissions", requireAuth, async (req: AuthedRequest, res) => {
  if (req.user!.role === "admin") {
    res.json({ role: req.user!.role, permissions: Object.values(PERMISSIONS) });
    return;
  }
  await ensureUserRoleAssigned(req.user!.companyId, req.user!.id, req.user!.role);
  const permissions = await permissionResolver.resolve(req.user!.companyId, req.user!.id);
  res.json({ role: req.user!.role, permissions });
});

router.get("/users", requireAuth, requireRole("admin"), async (req: AuthedRequest, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      role: usersTable.role,
      permissions: usersTable.permissions,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.companyId, req.user!.companyId));
  res.json(users);
});

router.post(
  "/users",
  requireAuth,
  requireRole("admin"),
  requireAuthModular,
  requireWithinLimit("maxUsers", countCurrentUsersForCompany),
  async (req: AuthedRequest, res) => {
  const { username, password, role, permissions } = req.body;
  if (!username || !password || !role) {
    res.status(400).json({ error: "username, password and role are required" });
    return;
  }
  const [existingUser] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(eq(usersTable.username, username.trim())).limit(1);
  if (existingUser) {
    res.status(409).json({ error: "Username is already taken" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    companyId: req.user!.companyId,
    username: username.trim(),
    role,
    permissions: permissions ? JSON.stringify(permissions) : null,
    passwordHash,
    isActive: true,
  }).returning({
    id: usersTable.id, username: usersTable.username, role: usersTable.role,
    permissions: usersTable.permissions, isActive: usersTable.isActive, createdAt: usersTable.createdAt,
  });
  await syncUserRoleFromLegacy(req.user!.companyId, user.id, user.role);
  await logAudit({
    companyId: req.user!.companyId, userId: req.user!.id, action: "create_user",
    entityType: "user", entityId: user.id, newValue: { username: user.username, role: user.role },
  });
  res.status(201).json(user);
},
);

router.put("/users/:id", requireAuth, requireRole("admin"), async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const { role, permissions, isActive, password } = req.body;
  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = role;
  if (permissions !== undefined) updates.permissions = permissions ? JSON.stringify(permissions) : null;
  if (isActive !== undefined) updates.isActive = isActive;
  if (password) updates.passwordHash = await bcrypt.hash(password, 10);

  const [before] = await db.select({ role: usersTable.role, permissions: usersTable.permissions, isActive: usersTable.isActive })
    .from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.companyId, req.user!.companyId)));

  const [updated] = await db.update(usersTable).set(updates)
    .where(and(eq(usersTable.id, id), eq(usersTable.companyId, req.user!.companyId)))
    .returning({
      id: usersTable.id, username: usersTable.username, role: usersTable.role,
      permissions: usersTable.permissions, isActive: usersTable.isActive, createdAt: usersTable.createdAt,
    });
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (role !== undefined && role !== before?.role) {
    await syncUserRoleFromLegacy(req.user!.companyId, id, updated.role);
  }
  await logAudit({
    companyId: req.user!.companyId, userId: req.user!.id, action: "update_user_permissions",
    entityType: "user", entityId: id,
    oldValue: before ? { role: before.role, permissions: before.permissions, isActive: before.isActive } : undefined,
    newValue: { role: updated.role, permissions: updated.permissions, isActive: updated.isActive },
  });
  res.json(updated);
});

export default router;

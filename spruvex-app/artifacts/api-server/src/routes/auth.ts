import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable, companiesTable, settingsTable, paymentMethodsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { JWT_SECRET } from "../lib/jwt-secret";
import { requireAuth, requireRole, type AuthedRequest } from "../lib/auth-middleware";
import { ensureSeeded as ensureChartOfAccountsSeeded } from "../modules/accounting";

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
}

export async function seedDefaultUsers() {
  try {
    const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
    if (existing.length > 0) return;

    const [org] = await db.insert(companiesTable).values({ name: "Demo Shop" }).returning();
    await seedOrgDefaults(org.id, "Demo Shop");

    const defaults = [
      { username: "admin", role: "admin", password: "admin123" },
      { username: "manager", role: "store_manager", password: "manager123" },
      { username: "cashier", role: "cashier", password: "cashier123" },
      { username: "warehouse", role: "warehouse_staff", password: "warehouse123" },
      { username: "accountant", role: "accountant", password: "accountant123" },
    ];

    for (const u of defaults) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      await db.insert(usersTable).values({
        companyId: org.id,
        username: u.username,
        role: u.role,
        passwordHash,
        isActive: true,
      });
    }
    console.log("✓ Default Company and users seeded");
  } catch (err) {
    console.error("Failed to seed users:", err);
  }
}

// Creates a brand new tenant (Company) with its first admin user — the SaaS signup flow.
router.post("/register", async (req, res) => {
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

  const payload = { id: user.id, username: user.username, role: user.role, companyId: org.id };
  // sub mirrors id so this token is also accepted by the modular routers'
  // auth middleware (core/middleware/auth.middleware.ts), which reads sub.
  const token = jwt.sign({ ...payload, sub: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.status(201).json({ token, user: payload });
});

router.post("/login", async (req, res) => {
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

  const payload = { id: user.id, username: user.username, role: user.role, companyId: user.companyId };
  // sub mirrors id so this token is also accepted by the modular routers'
  // auth middleware (core/middleware/auth.middleware.ts), which reads sub.
  const token = jwt.sign({ ...payload, sub: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  res.json({
    token,
    user: payload,
  });
});

router.get("/me", requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
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

router.post("/users", requireAuth, requireRole("admin"), async (req: AuthedRequest, res) => {
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
  res.status(201).json(user);
});

router.put("/users/:id", requireAuth, requireRole("admin"), async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const { role, permissions, isActive, password } = req.body;
  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = role;
  if (permissions !== undefined) updates.permissions = permissions ? JSON.stringify(permissions) : null;
  if (isActive !== undefined) updates.isActive = isActive;
  if (password) updates.passwordHash = await bcrypt.hash(password, 10);

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
  res.json(updated);
});

export default router;

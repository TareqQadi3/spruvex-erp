// Bootstraps a SpruVex platform-staff user with cross-tenant super-admin
// access (usersTable.isPlatformAdmin = true). Deliberately NOT an API
// endpoint — see users.ts's isPlatformAdmin column comment: there must be no
// request path that lets anyone set this flag, so it's only ever settable
// via direct DB access or this standalone script.
//
// Usage:
//   tsx scripts/seedPlatformAdmin.ts <username> <password>
//
// Idempotent: if a user with <username> already exists, reports that and
// exits cleanly (0) instead of erroring or creating a duplicate.
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool, companiesTable, usersTable } from "@workspace/db";
import { BCRYPT_ROUNDS } from "../src/modules/auth/services/authService";

const PLATFORM_COMPANY_NAME = "SpruVex Platform";
const PLATFORM_ADMIN_ROLE = "platform_admin";

async function findOrCreatePlatformCompany(): Promise<{ id: string }> {
  const [existing] = await db
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(eq(companiesTable.name, PLATFORM_COMPANY_NAME))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(companiesTable)
    .values({ name: PLATFORM_COMPANY_NAME })
    .returning({ id: companiesTable.id });
  return created;
}

async function main(): Promise<void> {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.error("Usage: tsx scripts/seedPlatformAdmin.ts <username> <password>");
    process.exitCode = 1;
    return;
  }

  const [existingUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (existingUser) {
    console.log(`User "${username}" already exists (id: ${existingUser.id}) — nothing to do.`);
    return;
  }

  const platformCompany = await findOrCreatePlatformCompany();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [user] = await db
    .insert(usersTable)
    .values({
      companyId: platformCompany.id,
      username,
      role: PLATFORM_ADMIN_ROLE,
      passwordHash,
      isActive: true,
      isPlatformAdmin: true,
    })
    .returning({ id: usersTable.id, username: usersTable.username });

  console.log(`Created platform admin "${user.username}" (id: ${user.id}) in company "${PLATFORM_COMPANY_NAME}" (id: ${platformCompany.id}).`);
}

main()
  .catch((err) => {
    console.error("Failed to seed platform admin:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

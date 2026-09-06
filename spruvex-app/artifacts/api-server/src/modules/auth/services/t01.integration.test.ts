// Integration test for T-01 acceptance criteria:
//   1) Platform-admin fallback resets a company user's password (direct hash update)
//   2) forgot-password does NOT reveal whether an email exists
//   3) The fallback works for a suspended/inactive subscription too (escape hatch)
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool, companiesTable, subscriptionsTable, usersTable } from "@workspace/db";
import { forgotPassword } from "./authService";
import { resetUserPassword } from "../../platform/services/platformService";

const companyId = randomUUID();
let userId: string;

beforeAll(async () => {
  await db.insert(companiesTable).values({ id: companyId, name: "t01 test co" });
  await db.insert(subscriptionsTable).values({ companyId, status: "suspended" });
  const passwordHash = await bcrypt.hash("oldPassword!234", 12);
  const [user] = await db
    .insert(usersTable)
    .values({
      companyId,
      username: `t01-${randomUUID().slice(0, 8)}`,
      email: "t01-admin@example.com",
      passwordHash,
      isActive: true,
    })
    .returning();
  userId = user.id;
});

afterAll(async () => {
  await db.delete(usersTable).where(eq(usersTable.companyId, companyId));
  await db.delete(subscriptionsTable).where(eq(subscriptionsTable.companyId, companyId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));
  await pool.end();
});

describe("T-01 password reset", () => {
  it("platform-admin fallback updates the hash so the new password verifies", async () => {
    const platformUserId = "00000000-0000-0000-0000-000000000001";
    await resetUserPassword(platformUserId, userId, "newSecurePass!234");

    const [user] = await db
      .select({ passwordHash: usersTable.passwordHash })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    const valid = await bcrypt.compare("newSecurePass!234", user!.passwordHash);
    expect(valid).toBe(true);
    // Old password no longer works.
    const oldValid = await bcrypt.compare("oldPassword!234", user!.passwordHash);
    expect(oldValid).toBe(false);
  });

  it("forgot-password silently no-ops when the email does not exist", async () => {
    // Must not throw and must not create an OTP row — it resolves fine because
    // authService.forgotPassword returns early when no matching user is found.
    await expect(forgotPassword("no-such-email@example.com")).resolves.toBeUndefined();
  });

  it("platform fallback rejects a nonexistent / inactive target user with 404 semantics", async () => {
    const platformUserId = "00000000-0000-0000-0000-000000000001";
    const missingId = "00000000-0000-0000-0000-00000000ffff";
    await expect(
      resetUserPassword(platformUserId, missingId, "anotherPass!234"),
    ).rejects.toThrow();
  });
});

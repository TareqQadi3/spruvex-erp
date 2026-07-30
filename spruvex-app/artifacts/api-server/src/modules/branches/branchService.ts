import { and, eq } from "drizzle-orm";
import { db, branchesTable, userBranchesTable } from "@workspace/db";
import { withTransaction, type DbOrTx } from "../../core/database/transaction";
import { AppError } from "../../core/errors/AppError";

export interface CreateBranchInput {
  name: string;
  code?: string;
  address?: string;
  phone?: string;
}

export interface UpdateBranchInput {
  name?: string;
  code?: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
  isDefault?: boolean;
}

export async function listBranches(companyId: string, client: DbOrTx = db) {
  return client.select().from(branchesTable).where(eq(branchesTable.companyId, companyId));
}

export async function getBranch(companyId: string, branchId: string, client: DbOrTx = db) {
  const [branch] = await client.select().from(branchesTable)
    .where(and(eq(branchesTable.id, branchId), eq(branchesTable.companyId, companyId)));
  if (!branch) throw AppError.notFound("Branch not found");
  return branch;
}

export async function createBranch(companyId: string, input: CreateBranchInput, client: DbOrTx = db) {
  const [branch] = await client.insert(branchesTable).values({
    companyId, name: input.name, code: input.code, address: input.address, phone: input.phone,
    isDefault: false, isActive: true,
  }).returning();
  return branch;
}

export async function updateBranch(companyId: string, branchId: string, input: UpdateBranchInput, client: DbOrTx = db) {
  if (input.isDefault) {
    // Clear-then-set, transactionally — same pattern as warehouses'
    // isDefault toggle — so exactly one default branch ever survives.
    return withTransaction(async (tx) => {
      await tx.update(branchesTable).set({ isDefault: false })
        .where(and(eq(branchesTable.companyId, companyId), eq(branchesTable.isDefault, true)));
      const [updated] = await tx.update(branchesTable).set(input)
        .where(and(eq(branchesTable.id, branchId), eq(branchesTable.companyId, companyId)))
        .returning();
      if (!updated) throw AppError.notFound("Branch not found");
      return updated;
    });
  }
  const [updated] = await client.update(branchesTable).set(input)
    .where(and(eq(branchesTable.id, branchId), eq(branchesTable.companyId, companyId)))
    .returning();
  if (!updated) throw AppError.notFound("Branch not found");
  return updated;
}

// Soft delete only — a branch can be referenced by warehouses/sales/users;
// deactivating (not removing the row) keeps every historical reference
// valid. The default branch can never be deactivated (every company must
// always have at least one working branch).
export async function deactivateBranch(companyId: string, branchId: string, client: DbOrTx = db) {
  const branch = await getBranch(companyId, branchId, client);
  if (branch.isDefault) throw AppError.validation("Cannot deactivate the default branch");
  const [updated] = await client.update(branchesTable).set({ isActive: false })
    .where(and(eq(branchesTable.id, branchId), eq(branchesTable.companyId, companyId)))
    .returning();
  return updated;
}

export async function countActiveBranches(companyId: string, client: DbOrTx = db): Promise<number> {
  const rows = await client.select({ id: branchesTable.id }).from(branchesTable)
    .where(and(eq(branchesTable.companyId, companyId), eq(branchesTable.isActive, true)));
  return rows.length;
}

// A user with zero explicit user_branches rows (every user created before
// Phase 7, or a normal single-branch company where nobody bothers assigning
// branches) is implicitly a member of the company's default branch only —
// lazy fallback, same pattern as Phase 6's role backfill, no migration
// script required.
export async function listUserBranches(companyId: string, userId: string, client: DbOrTx = db) {
  const rows = await client.select({
    id: branchesTable.id, name: branchesTable.name, code: branchesTable.code, isDefault: branchesTable.isDefault,
  }).from(userBranchesTable)
    .innerJoin(branchesTable, eq(userBranchesTable.branchId, branchesTable.id))
    .where(and(eq(userBranchesTable.companyId, companyId), eq(userBranchesTable.userId, userId), eq(branchesTable.isActive, true)));

  if (rows.length > 0) return rows;

  const [defaultBranch] = await client.select({
    id: branchesTable.id, name: branchesTable.name, code: branchesTable.code, isDefault: branchesTable.isDefault,
  }).from(branchesTable).where(and(eq(branchesTable.companyId, companyId), eq(branchesTable.isDefault, true)));
  return defaultBranch ? [defaultBranch] : [];
}

export async function isUserAllowedBranch(companyId: string, userId: string, branchId: string, client: DbOrTx = db): Promise<boolean> {
  const branches = await listUserBranches(companyId, userId, client);
  return branches.some(b => b.id === branchId);
}

export async function assignUserBranch(companyId: string, userId: string, branchId: string, client: DbOrTx = db) {
  await getBranch(companyId, branchId, client); // 404s if the branch isn't this company's
  const [row] = await client.insert(userBranchesTable).values({ companyId, userId, branchId })
    .onConflictDoNothing().returning();
  return row;
}

export async function revokeUserBranch(companyId: string, userBranchId: string, client: DbOrTx = db) {
  const [row] = await client.delete(userBranchesTable)
    .where(and(eq(userBranchesTable.id, userBranchId), eq(userBranchesTable.companyId, companyId)))
    .returning();
  if (!row) throw AppError.notFound("Branch assignment not found");
  return row;
}

export async function listBranchUsers(companyId: string, branchId: string, client: DbOrTx = db) {
  return client.select({ id: userBranchesTable.id, userId: userBranchesTable.userId, createdAt: userBranchesTable.createdAt })
    .from(userBranchesTable)
    .where(and(eq(userBranchesTable.companyId, companyId), eq(userBranchesTable.branchId, branchId)));
}

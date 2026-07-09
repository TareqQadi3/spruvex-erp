import { AppError } from "../../../core/errors/AppError";
import { PermissionRepository } from "../repositories/permissionRepository";
import type { CreatePermissionInput, PermissionSummary, UpdatePermissionInput } from "../types/rbac.types";

const repo = new PermissionRepository();

function toSummary(row: {
  id: string;
  companyId: string | null;
  code: string;
  module: string;
  description: string | null;
}): PermissionSummary {
  return { id: row.id, companyId: row.companyId, code: row.code, module: row.module, description: row.description };
}

export async function listPermissions(companyId: string): Promise<PermissionSummary[]> {
  const rows = await repo.listAccessible(companyId);
  return rows.map(toSummary);
}

export async function getPermission(companyId: string, permissionId: string): Promise<PermissionSummary> {
  const row = await repo.findAccessibleById(companyId, permissionId);
  if (!row) throw AppError.notFound("Permission not found");
  return toSummary(row);
}

// Permissions created via the API are always tenant-owned — the global
// catalog (company_id IS NULL) is seeded once at startup, never through here.
export async function createPermission(companyId: string, input: CreatePermissionInput): Promise<PermissionSummary> {
  const row = await repo.create({ companyId, ...input });
  return toSummary(row);
}

export async function updatePermission(
  companyId: string,
  permissionId: string,
  input: UpdatePermissionInput,
): Promise<PermissionSummary> {
  const row = await repo.updateOwn(companyId, permissionId, input);
  if (!row) throw AppError.notFound("Permission not found or not editable (global permissions are read-only)");
  return toSummary(row);
}

export async function deletePermission(companyId: string, permissionId: string): Promise<void> {
  const row = await repo.deleteOwn(companyId, permissionId);
  if (!row) throw AppError.notFound("Permission not found or not deletable (global permissions are read-only)");
}

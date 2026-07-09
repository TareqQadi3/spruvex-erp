import { db } from "../../../core/database/connection";
import { withTransaction, type DbOrTx } from "../../../core/database/transaction";
import { AppError } from "../../../core/errors/AppError";
import { RoleRepository } from "../repositories/roleRepository";
import { PermissionRepository } from "../repositories/permissionRepository";
import { RolePermissionRepository } from "../repositories/rolePermissionRepository";
import { UserRoleRepository } from "../repositories/userRoleRepository";
import type {
  AssignUserRoleInput,
  CreateRoleInput,
  RoleDetail,
  RoleSummary,
  UpdateRoleInput,
  UserRoleSummary,
} from "../types/rbac.types";

const roleRepo = new RoleRepository();
const permissionRepo = new PermissionRepository();
const rolePermissionRepo = new RolePermissionRepository();
const userRoleRepo = new UserRoleRepository();

function toSummary(role: { id: string; companyId: string | null; name: string; displayName: string; isSystem: boolean }): RoleSummary {
  return { id: role.id, companyId: role.companyId, name: role.name, displayName: role.displayName, isSystem: role.isSystem };
}

async function toDetail(role: Parameters<typeof toSummary>[0], client: DbOrTx = db): Promise<RoleDetail> {
  const permissions = await rolePermissionRepo.listForRole(role.id, client);
  return { ...toSummary(role), permissions };
}

async function resolvePermissionIds(companyId: string, codes: string[], client: DbOrTx = db): Promise<string[]> {
  if (codes.length === 0) return [];
  const found = await permissionRepo.findManyAccessibleByCodes(companyId, codes, client);
  const missing = codes.filter((code) => !found.some((p) => p.code === code));
  if (missing.length > 0) {
    throw AppError.validation(`Unknown permission code(s): ${missing.join(", ")}`);
  }
  return found.map((p) => p.id);
}

export async function listRoles(companyId: string): Promise<RoleSummary[]> {
  const rows = await roleRepo.listAccessible(companyId);
  return rows.map(toSummary);
}

export async function getRole(companyId: string, roleId: string): Promise<RoleDetail> {
  const role = await roleRepo.findAccessibleById(companyId, roleId);
  if (!role) throw AppError.notFound("Role not found");
  return toDetail(role);
}

export async function createRole(companyId: string, input: CreateRoleInput): Promise<RoleDetail> {
  return withTransaction(async (tx) => {
    const permissionIds = await resolvePermissionIds(companyId, input.permissionCodes, tx);
    const role = await roleRepo.create({ companyId, name: input.name, displayName: input.displayName }, tx);
    await rolePermissionRepo.replaceForRole(companyId, role.id, permissionIds, tx);
    return toDetail(role, tx);
  });
}

async function assertOwnEditableRole(companyId: string, roleId: string) {
  const role = await roleRepo.findAccessibleById(companyId, roleId);
  if (!role) throw AppError.notFound("Role not found");
  if (role.companyId !== companyId) throw AppError.forbidden("System roles cannot be modified");
  if (role.isSystem) throw AppError.forbidden("System roles cannot be modified");
  return role;
}

export async function updateRole(companyId: string, roleId: string, input: UpdateRoleInput): Promise<RoleDetail> {
  await assertOwnEditableRole(companyId, roleId);

  return withTransaction(async (tx) => {
    if (input.displayName !== undefined) {
      await roleRepo.updateOwn(companyId, roleId, { displayName: input.displayName }, tx);
    }
    if (input.permissionCodes !== undefined) {
      const permissionIds = await resolvePermissionIds(companyId, input.permissionCodes, tx);
      await rolePermissionRepo.replaceForRole(companyId, roleId, permissionIds, tx);
    }
    const role = await roleRepo.findAccessibleById(companyId, roleId, tx);
    if (!role) throw AppError.notFound("Role not found");
    return toDetail(role, tx);
  });
}

export async function deleteRole(companyId: string, roleId: string): Promise<void> {
  await assertOwnEditableRole(companyId, roleId);
  await withTransaction(async (tx) => {
    await rolePermissionRepo.replaceForRole(companyId, roleId, [], tx);
    await roleRepo.deleteOwn(companyId, roleId, tx);
  });
}

export async function assignPermissionToRole(companyId: string, roleId: string, permissionId: string): Promise<void> {
  await assertOwnEditableRole(companyId, roleId);
  const permission = await permissionRepo.findAccessibleById(companyId, permissionId);
  if (!permission) throw AppError.notFound("Permission not found");
  await rolePermissionRepo.assign(companyId, roleId, permissionId);
}

export async function revokePermissionFromRole(companyId: string, roleId: string, permissionId: string): Promise<void> {
  await assertOwnEditableRole(companyId, roleId);
  await rolePermissionRepo.revoke(roleId, permissionId);
}

// --- user_roles assignment (kept here rather than a separate service file —
// assigning a role to a user is role management, not a distinct domain) ---

export async function listUserRoles(companyId: string, userId: string): Promise<UserRoleSummary[]> {
  return userRoleRepo.listForUser(companyId, userId);
}

export async function assignUserRole(
  companyId: string,
  userId: string,
  input: AssignUserRoleInput,
  grantedBy: string,
): Promise<UserRoleSummary> {
  const role = await roleRepo.findAccessibleById(companyId, input.roleId);
  if (!role) throw AppError.notFound("Role not found");

  const row = await userRoleRepo.assign({
    companyId,
    userId,
    roleId: input.roleId,
    branchId: input.branchId,
    grantedBy,
  });
  return { id: row.id, roleId: row.roleId, roleName: role.name, branchId: row.branchId };
}

export async function revokeUserRole(companyId: string, userRoleId: string): Promise<void> {
  const row = await userRoleRepo.revokeOwn(companyId, userRoleId);
  if (!row) throw AppError.notFound("Role assignment not found");
}

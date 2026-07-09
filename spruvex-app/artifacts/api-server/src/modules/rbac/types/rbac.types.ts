export interface RoleSummary {
  id: string;
  companyId: string | null;
  name: string;
  displayName: string;
  isSystem: boolean;
}

export interface RolePermissionSummary {
  permissionId: string;
  code: string;
  module: string;
  description: string | null;
}

export interface RoleDetail extends RoleSummary {
  permissions: RolePermissionSummary[];
}

export interface PermissionSummary {
  id: string;
  companyId: string | null;
  code: string;
  module: string;
  description: string | null;
}

export interface UserRoleSummary {
  id: string;
  roleId: string;
  roleName: string;
  branchId: string | null;
}

export interface CreateRoleInput {
  name: string;
  displayName: string;
  permissionCodes: string[];
}

export interface UpdateRoleInput {
  displayName?: string;
  permissionCodes?: string[];
}

export interface CreatePermissionInput {
  code: string;
  module: string;
  description?: string;
}

export interface UpdatePermissionInput {
  module?: string;
  description?: string;
}

export interface AssignUserRoleInput {
  roleId: string;
  branchId?: string;
}

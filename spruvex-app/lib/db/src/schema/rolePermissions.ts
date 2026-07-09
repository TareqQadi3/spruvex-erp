import { pgTable, uuid, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Junction between roles and permissions. companyId is nullable and mirrors
// whichever side is tenant-scoped (a global role/permission pairing has
// companyId null; a tenant's custom role or custom permission carries its
// own companyId here) — tenant-consistency between role/permission/company_id
// is enforced in the RBAC service layer, not a DB constraint, since a role or
// permission may legitimately be global while the other is tenant-owned.
export const rolePermissionsTable = pgTable("role_permissions", {
  roleId: uuid("role_id").notNull(),
  permissionId: uuid("permission_id").notNull(),
  companyId: uuid("company_id"),
}, (table) => [
  primaryKey({ columns: [table.roleId, table.permissionId] }),
]);

export const insertRolePermissionSchema = createInsertSchema(rolePermissionsTable);
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissionsTable.$inferSelect;

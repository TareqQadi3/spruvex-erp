import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(50),
  displayName: z.string().trim().min(1).max(100),
  permissionCodes: z.array(z.string()).default([]),
});

export const updateRoleSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  permissionCodes: z.array(z.string()).optional(),
});

export const createPermissionSchema = z.object({
  code: z.string().trim().min(1).max(100),
  module: z.string().trim().min(1).max(50),
  description: z.string().max(500).optional(),
});

export const updatePermissionSchema = z.object({
  module: z.string().trim().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
});

export const assignUserRoleSchema = z.object({
  roleId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
});

import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import { AppError } from "../../../core/errors/AppError";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import { uuidParamSchema } from "../../../shared/validators/common.validators";
import { createRoleSchema, updateRoleSchema } from "../validators/rbac.validators";
import * as roleService from "../services/roleService";
import { PERMISSIONS } from "@workspace/db";
import { logAudit } from "../../auditLog/auditLogService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation);

router.get("/", async (req, res, next) => {
  try {
    const roles = await roleService.listRoles(req.tenant!.companyId);
    res.status(200).json(buildSuccess(roles));
  } catch (err) {
    next(err);
  }
});

router.post("/", requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res, next) => {
  try {
    const input = createRoleSchema.parse(req.body);
    const role = await roleService.createRole(req.tenant!.companyId, input);
    await logAudit({
      companyId: req.tenant!.companyId, userId: req.tenant!.userId, action: "create_role",
      entityType: "role", entityId: role.id, newValue: { name: role.name, permissions: input.permissionCodes },
    });
    res.status(201).json(buildSuccess(role));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const roleId = uuidParamSchema.parse(req.params.id);
    const role = await roleService.getRole(req.tenant!.companyId, roleId);
    res.status(200).json(buildSuccess(role));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res, next) => {
  try {
    const roleId = uuidParamSchema.parse(req.params.id);
    const input = updateRoleSchema.parse(req.body);
    const role = await roleService.updateRole(req.tenant!.companyId, roleId, input);
    await logAudit({
      companyId: req.tenant!.companyId, userId: req.tenant!.userId, action: "edit_permissions",
      entityType: "role", entityId: roleId, newValue: input,
    });
    res.status(200).json(buildSuccess(role));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res, next) => {
  try {
    const roleId = uuidParamSchema.parse(req.params.id);
    await roleService.deleteRole(req.tenant!.companyId, roleId);
    res.status(200).json(buildSuccess({ success: true }));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/permissions", requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res, next) => {
  try {
    const roleId = uuidParamSchema.parse(req.params.id);
    const permissionId = uuidParamSchema.parse(req.body.permissionId);
    await roleService.assignPermissionToRole(req.tenant!.companyId, roleId, permissionId);
    await logAudit({
      companyId: req.tenant!.companyId, userId: req.tenant!.userId, action: "edit_permissions",
      entityType: "role", entityId: roleId, newValue: { grantedPermissionId: permissionId },
    });
    res.status(201).json(buildSuccess({ success: true }));
  } catch (err) {
    next(err);
  }
});

router.delete(
  "/:id/permissions/:permissionId",
  requirePermission(PERMISSIONS.MANAGE_SETTINGS),
  async (req, res, next) => {
    try {
      const roleId = uuidParamSchema.parse(req.params.id);
      const permissionId = uuidParamSchema.parse(req.params.permissionId);
      if (!req.tenant) throw AppError.unauthorized();
      await roleService.revokePermissionFromRole(req.tenant.companyId, roleId, permissionId);
      await logAudit({
        companyId: req.tenant.companyId, userId: req.tenant.userId, action: "edit_permissions",
        entityType: "role", entityId: roleId, oldValue: { revokedPermissionId: permissionId },
      });
      res.status(200).json(buildSuccess({ success: true }));
    } catch (err) {
      next(err);
    }
  },
);

export default router;

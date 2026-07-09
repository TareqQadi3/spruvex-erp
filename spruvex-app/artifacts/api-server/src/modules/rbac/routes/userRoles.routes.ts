import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import { uuidParamSchema } from "../../../shared/validators/common.validators";
import { assignUserRoleSchema } from "../validators/rbac.validators";
import * as roleService from "../services/roleService";
import { PERMISSIONS } from "@workspace/db";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation);

router.get("/users/:userId/roles", async (req, res, next) => {
  try {
    const userId = uuidParamSchema.parse(req.params.userId);
    const roles = await roleService.listUserRoles(req.tenant!.companyId, userId);
    res.status(200).json(buildSuccess(roles));
  } catch (err) {
    next(err);
  }
});

router.post("/users/:userId/roles", requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res, next) => {
  try {
    const userId = uuidParamSchema.parse(req.params.userId);
    const input = assignUserRoleSchema.parse(req.body);
    const assignment = await roleService.assignUserRole(req.tenant!.companyId, userId, input, req.tenant!.userId);
    res.status(201).json(buildSuccess(assignment));
  } catch (err) {
    next(err);
  }
});

router.delete("/user-roles/:id", requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res, next) => {
  try {
    const userRoleId = uuidParamSchema.parse(req.params.id);
    await roleService.revokeUserRole(req.tenant!.companyId, userRoleId);
    res.status(200).json(buildSuccess({ success: true }));
  } catch (err) {
    next(err);
  }
});

export default router;

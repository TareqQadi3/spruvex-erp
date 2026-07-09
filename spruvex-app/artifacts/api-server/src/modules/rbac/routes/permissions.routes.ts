import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import { uuidParamSchema } from "../../../shared/validators/common.validators";
import { createPermissionSchema, updatePermissionSchema } from "../validators/rbac.validators";
import * as permissionService from "../services/permissionService";
import { PERMISSIONS } from "@workspace/db";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation);

router.get("/", async (req, res, next) => {
  try {
    const permissions = await permissionService.listPermissions(req.tenant!.companyId);
    res.status(200).json(buildSuccess(permissions));
  } catch (err) {
    next(err);
  }
});

router.post("/", requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res, next) => {
  try {
    const input = createPermissionSchema.parse(req.body);
    const permission = await permissionService.createPermission(req.tenant!.companyId, input);
    res.status(201).json(buildSuccess(permission));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const permissionId = uuidParamSchema.parse(req.params.id);
    const permission = await permissionService.getPermission(req.tenant!.companyId, permissionId);
    res.status(200).json(buildSuccess(permission));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res, next) => {
  try {
    const permissionId = uuidParamSchema.parse(req.params.id);
    const input = updatePermissionSchema.parse(req.body);
    const permission = await permissionService.updatePermission(req.tenant!.companyId, permissionId, input);
    res.status(200).json(buildSuccess(permission));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res, next) => {
  try {
    const permissionId = uuidParamSchema.parse(req.params.id);
    await permissionService.deletePermission(req.tenant!.companyId, permissionId);
    res.status(200).json(buildSuccess({ success: true }));
  } catch (err) {
    next(err);
  }
});

export default router;

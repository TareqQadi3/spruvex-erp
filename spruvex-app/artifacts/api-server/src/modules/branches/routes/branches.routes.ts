import { Router, type IRouter } from "express";
import { PERMISSIONS } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import { requireWithinLimit } from "../../../core/middleware/subscription.middleware";
import { uuidParamSchema } from "../../../shared/validators/common.validators";
import { AppError } from "../../../core/errors/AppError";
import * as branchService from "../branchService";
import { logAudit } from "../../auditLog/auditLogService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation);

router.get("/", async (req, res, next) => {
  try {
    res.json(await branchService.listBranches(req.tenant!.companyId));
  } catch (err) { next(err); }
});

router.get("/me", async (req, res, next) => {
  try {
    res.json(await branchService.listUserBranches(req.tenant!.companyId, req.tenant!.userId));
  } catch (err) { next(err); }
});

router.post(
  "/",
  requirePermission(PERMISSIONS.BRANCHES_MANAGE),
  requireWithinLimit("maxBranches", branchService.countActiveBranches),
  async (req, res, next) => {
    try {
      const { name, code, address, phone } = req.body;
      if (!name) throw AppError.validation("name is required");
      const branch = await branchService.createBranch(req.tenant!.companyId, { name, code, address, phone });
      await logAudit({
        companyId: req.tenant!.companyId, userId: req.tenant!.userId, action: "create_branch",
        entityType: "branch", entityId: branch.id, newValue: { name: branch.name, code: branch.code },
      });
      res.status(201).json(branch);
    } catch (err) { next(err); }
  },
);

router.put("/:id", requirePermission(PERMISSIONS.BRANCHES_MANAGE), async (req, res, next) => {
  try {
    const id = uuidParamSchema.parse(req.params.id);
    const { name, code, address, phone, isActive } = req.body;
    const branch = await branchService.updateBranch(req.tenant!.companyId, id, { name, code, address, phone, isActive });
    await logAudit({
      companyId: req.tenant!.companyId, userId: req.tenant!.userId, action: "update_branch",
      entityType: "branch", entityId: id, newValue: { name: branch.name, isActive: branch.isActive },
    });
    res.json(branch);
  } catch (err) { next(err); }
});

router.delete("/:id", requirePermission(PERMISSIONS.BRANCHES_MANAGE), async (req, res, next) => {
  try {
    const id = uuidParamSchema.parse(req.params.id);
    const branch = await branchService.deactivateBranch(req.tenant!.companyId, id);
    await logAudit({
      companyId: req.tenant!.companyId, userId: req.tenant!.userId, action: "deactivate_branch",
      entityType: "branch", entityId: id,
    });
    res.json(branch);
  } catch (err) { next(err); }
});

router.get("/:id/users", requirePermission(PERMISSIONS.BRANCHES_MANAGE), async (req, res, next) => {
  try {
    const id = uuidParamSchema.parse(req.params.id);
    res.json(await branchService.listBranchUsers(req.tenant!.companyId, id));
  } catch (err) { next(err); }
});

router.post("/:id/users", requirePermission(PERMISSIONS.BRANCHES_MANAGE), async (req, res, next) => {
  try {
    const id = uuidParamSchema.parse(req.params.id);
    const userId = uuidParamSchema.parse(req.body.userId);
    const row = await branchService.assignUserBranch(req.tenant!.companyId, userId, id);
    await logAudit({
      companyId: req.tenant!.companyId, userId: req.tenant!.userId, action: "assign_branch",
      entityType: "user", entityId: userId, newValue: { branchId: id },
    });
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.delete("/user-branches/:id", requirePermission(PERMISSIONS.BRANCHES_MANAGE), async (req, res, next) => {
  try {
    const id = uuidParamSchema.parse(req.params.id);
    await branchService.revokeUserBranch(req.tenant!.companyId, id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;

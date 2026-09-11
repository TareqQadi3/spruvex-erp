import { Router, type IRouter } from "express";
import { db, PERMISSIONS } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import * as departmentService from "../services/departmentService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/", requirePermission(PERMISSIONS.HR_VIEW), async (req, res) => {
  res.json(await departmentService.listDepartments(db, req.tenant!.companyId));
});

router.post("/", requirePermission(PERMISSIONS.HR_MANAGE), async (req, res) => {
  try {
    const department = await departmentService.createDepartment(db, req.tenant!.companyId, req.body);
    res.status(201).json(department);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create department" });
  }
});

router.put("/:id", requirePermission(PERMISSIONS.HR_MANAGE), async (req, res) => {
  const updated = await departmentService.updateDepartment(db, req.tenant!.companyId, req.params.id as string, req.body);
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

router.delete("/:id", requirePermission(PERMISSIONS.HR_MANAGE), async (req, res) => {
  await departmentService.deleteDepartment(db, req.tenant!.companyId, req.params.id as string);
  res.status(204).send();
});

export default router;

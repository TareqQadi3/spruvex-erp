import { Router, type IRouter } from "express";
import { db, PERMISSIONS } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import * as employeeService from "../services/employeeService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/", requirePermission(PERMISSIONS.HR_VIEW), async (req, res) => {
  const departmentId = req.query.departmentId as string | undefined;
  res.json(await employeeService.listEmployees(db, req.tenant!.companyId, departmentId));
});

router.post("/", requirePermission(PERMISSIONS.HR_MANAGE), async (req, res) => {
  try {
    const employee = await employeeService.createEmployee(db, req.tenant!.companyId, req.body);
    res.status(201).json(employee);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create employee" });
  }
});

router.get("/:id", requirePermission(PERMISSIONS.HR_VIEW), async (req, res) => {
  const employee = await employeeService.getEmployee(db, req.tenant!.companyId, req.params.id as string);
  if (!employee) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(employee);
});

router.put("/:id", requirePermission(PERMISSIONS.HR_MANAGE), async (req, res) => {
  const updated = await employeeService.updateEmployee(db, req.tenant!.companyId, req.params.id as string, req.body);
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

router.delete("/:id", requirePermission(PERMISSIONS.HR_MANAGE), async (req, res) => {
  await employeeService.deleteEmployee(db, req.tenant!.companyId, req.params.id as string);
  res.status(204).send();
});

export default router;

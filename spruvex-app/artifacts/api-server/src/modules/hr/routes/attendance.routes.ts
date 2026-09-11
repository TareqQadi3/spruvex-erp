import { Router, type IRouter } from "express";
import { db, PERMISSIONS } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import * as attendanceService from "../services/attendanceService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/", requirePermission(PERMISSIONS.HR_VIEW), async (req, res) => {
  const employeeId = req.query.employeeId as string | undefined;
  if (!employeeId) {
    res.status(400).json({ error: "employeeId is required" });
    return;
  }
  res.json(await attendanceService.listAttendance(db, req.tenant!.companyId, employeeId));
});

router.post("/clock-in", requirePermission(PERMISSIONS.HR_MANAGE), async (req, res) => {
  try {
    const record = await attendanceService.clockIn(db, req.tenant!.companyId, req.body);
    res.status(201).json(record);
  } catch (err) {
    if (err instanceof attendanceService.AlreadyClockedInError) {
      res.status(409).json({ error: err.message });
      return;
    }
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to clock in" });
  }
});

router.post("/:id/clock-out", requirePermission(PERMISSIONS.HR_MANAGE), async (req, res) => {
  try {
    const record = await attendanceService.clockOut(db, req.tenant!.companyId, req.params.id as string);
    if (!record) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(record);
  } catch (err) {
    if (err instanceof attendanceService.AlreadyClockedOutError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;

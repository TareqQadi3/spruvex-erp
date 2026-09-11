import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import { ValidationError } from "../../../lib/validation";
import * as repairService from "../services/repairService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/", async (req, res) => {
  const { status, search, customerId } = req.query;
  const rows = await repairService.listRepairs(req.tenant!.companyId, {
    status: status as string | undefined,
    search: search as string | undefined,
    customerId: customerId as string | undefined,
  });
  res.json(rows);
});

// Past repairs for the same physical device, matched by IMEI or serial — surfaced so
// a returning device's history (issues, parts, technician, warranty) shows up without
// the front desk having to search for it manually.
router.get("/device-history", async (req, res) => {
  const { imei } = req.query;
  if (!imei) {
    res.status(400).json({ error: "imei is required" });
    return;
  }
  const rows = await repairService.listRepairsByImei(req.tenant!.companyId, imei as string);
  res.json(rows);
});

router.post("/", async (req, res) => {
  try {
    const repair = await repairService.createRepair(req.tenant!.companyId, req.tenant!.userId, req.body);
    res.status(201).json(repair);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.get("/:id", async (req, res) => {
  const detail = await repairService.getRepairDetail(req.tenant!.companyId, req.params.id as string);
  if (!detail) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(detail);
});

router.get("/:id/history", async (req, res) => {
  const rows = await repairService.getRepairHistory(req.tenant!.companyId, req.params.id as string);
  res.json(rows);
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await repairService.updateRepair(req.tenant!.companyId, req.tenant!.userId, req.params.id as string, req.body);
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.patch("/:id/status", async (req, res) => {
  const { status, technicianNotes } = req.body;
  if (!status) {
    res.status(400).json({ error: "status is required" });
    return;
  }
  try {
    const updated = await repairService.patchRepairStatus(req.tenant!.companyId, req.tenant!.userId, req.params.id as string, status, technicianNotes);
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.patch("/:id/technician", async (req, res) => {
  const { technicianId } = req.body;
  try {
    const updated = await repairService.assignTechnician(req.tenant!.companyId, req.params.id as string, technicianId);
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    if (err instanceof repairService.InvalidTechnicianError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.patch("/:id/approve", async (req, res) => {
  const updated = await repairService.approveRepair(req.tenant!.companyId, req.params.id as string);
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

export default router;

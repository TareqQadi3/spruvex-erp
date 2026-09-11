import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import * as unitService from "../services/unitService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/", async (req, res) => {
  res.json(await unitService.listUnits(db, req.tenant!.companyId));
});

router.post("/", async (req, res) => {
  try {
    const unit = await unitService.createUnit(db, req.tenant!.companyId, req.body);
    res.status(201).json(unit);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create unit" });
  }
});

export default router;

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import * as onboardingService from "../services/onboardingService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.post("/seed-catalog", async (req, res) => {
  const result = await onboardingService.seedCatalog(db, req.tenant!.companyId);
  res.status(201).json(result);
});

export default router;

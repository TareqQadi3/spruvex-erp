import { Router, type IRouter } from "express";
import { db, PERMISSIONS } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import * as settingsService from "../services/settingsService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/", async (req, res) => {
  res.json(await settingsService.buildSettingsResponse(db, req.tenant!.companyId));
});

router.put("/", requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  const updated = await settingsService.updateSettings(db, req.tenant!.companyId, req.body);
  res.json(updated);
});

export default router;

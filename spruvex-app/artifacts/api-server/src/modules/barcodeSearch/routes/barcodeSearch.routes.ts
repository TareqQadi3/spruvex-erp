import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import * as barcodeSearchService from "../services/barcodeSearchService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/:code", async (req, res) => {
  const match = await barcodeSearchService.searchByCode(db, req.tenant!.companyId, String(req.params.code));
  if (!match) {
    res.status(404).json({ error: "No product, repair ticket, or voucher matches this code" });
    return;
  }
  res.json(match);
});

export default router;

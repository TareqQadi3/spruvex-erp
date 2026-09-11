import { Router, type IRouter } from "express";
import { env } from "../../../config/env";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import * as affiliateService from "../services/affiliateService";

// No requireAuth here — this is called cross-product (SpruVex R's own
// backend, and internally by this app's own signup flow) rather than by a
// logged-in platform-admin browser session, so it's gated by a shared
// secret header instead, same convention as modules/payments/routes/
// paymentWebhooks.routes.ts (no router-level middleware, verified inside
// the handler).
const router: IRouter = Router();

router.post("/report-conversion", async (req, res, next) => {
  const providedKey = req.headers["x-affiliate-report-key"];
  if (!env.affiliateReportApiKey || providedKey !== env.affiliateReportApiKey) {
    // Fail-closed: an unset key rejects every request, never accepts one.
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const { referralCode, product, externalCompanyId, companyName, planCode } = req.body;
    if (!referralCode || !product || !externalCompanyId || !companyName || !planCode) {
      res.status(400).json({ error: "referralCode, product, externalCompanyId, companyName and planCode are required" });
      return;
    }
    if (product !== "erp" && product !== "r") {
      res.status(400).json({ error: 'product must be "erp" or "r"' });
      return;
    }

    const conversion = await affiliateService.reportConversion({ referralCode, product, externalCompanyId, companyName, planCode });
    res.status(201).json(buildSuccess(conversion));
  } catch (err) {
    if (err instanceof affiliateService.UnknownReferralCodeError || err instanceof affiliateService.UnknownPlanError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof affiliateService.InactiveAffiliateError || err instanceof affiliateService.DuplicateConversionError) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

export default router;

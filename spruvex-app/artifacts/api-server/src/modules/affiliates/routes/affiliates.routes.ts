import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { requirePlatformAdmin } from "../../platform/middleware/platformAdmin.middleware";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import * as affiliateService from "../services/affiliateService";

// Same admin-only, cross-tenant-by-design gate every other
// modules/platform route uses (requireAuth + requirePlatformAdmin, no
// enforceTenantIsolation).
const router: IRouter = Router();
router.use(requireAuth, requirePlatformAdmin);

router.get("/affiliates", async (_req, res, next) => {
  try {
    res.status(200).json(buildSuccess(await affiliateService.listAffiliates()));
  } catch (err) {
    next(err);
  }
});

router.post("/affiliates", async (req, res, next) => {
  try {
    const affiliate = await affiliateService.createAffiliate(req.body);
    res.status(201).json(buildSuccess(affiliate));
  } catch (err) {
    if (err instanceof affiliateService.DuplicateAffiliateError) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

router.get("/conversions", async (req, res, next) => {
  try {
    const affiliateId = req.query.affiliateId as string | undefined;
    const status = req.query.status as string | undefined;
    res.status(200).json(buildSuccess(await affiliateService.listConversions(affiliateId, status)));
  } catch (err) {
    next(err);
  }
});

router.post("/conversions/:id/approve", async (req, res, next) => {
  try {
    const updated = await affiliateService.approveConversion(req.params.id as string);
    res.status(200).json(buildSuccess(updated));
  } catch (err) {
    if (err instanceof affiliateService.ConversionNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof affiliateService.InvalidConversionTransitionError) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

router.post("/conversions/:id/mark-paid", async (req, res, next) => {
  try {
    const updated = await affiliateService.markConversionPaid(req.params.id as string);
    res.status(200).json(buildSuccess(updated));
  } catch (err) {
    if (err instanceof affiliateService.ConversionNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof affiliateService.InvalidConversionTransitionError) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

export default router;

import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import { uuidParamSchema } from "../../../shared/validators/common.validators";
import { requirePlatformAdmin } from "../middleware/platformAdmin.middleware";
import {
  addonParamsSchema,
  changePlanSchema,
  changeStatusSchema,
  renewSubscriptionSchema,
  upsertAddonSchema,
} from "../validators/platform.validators";
import * as platformService from "../services/platformService";

const router: IRouter = Router();

// Deliberately requireAuth + requirePlatformAdmin only — NOT
// enforceTenantIsolation. Every route below reads/writes across every
// company by design (see platformAdmin.middleware.ts).
router.use(requireAuth, requirePlatformAdmin);

router.get("/companies", async (_req, res, next) => {
  try {
    const companies = await platformService.listCompanies();
    res.status(200).json(buildSuccess(companies));
  } catch (err) {
    next(err);
  }
});

router.get("/companies/:id", async (req, res, next) => {
  try {
    const companyId = uuidParamSchema.parse(req.params.id);
    const company = await platformService.getCompany(companyId);
    res.status(200).json(buildSuccess(company));
  } catch (err) {
    next(err);
  }
});

router.patch("/companies/:id/plan", async (req, res, next) => {
  try {
    const companyId = uuidParamSchema.parse(req.params.id);
    const { plan } = changePlanSchema.parse(req.body);
    const company = await platformService.changePlan(companyId, plan);
    res.status(200).json(buildSuccess(company));
  } catch (err) {
    next(err);
  }
});

router.patch("/companies/:id/status", async (req, res, next) => {
  try {
    const companyId = uuidParamSchema.parse(req.params.id);
    const { status } = changeStatusSchema.parse(req.body);
    const company = await platformService.changeStatus(companyId, status);
    res.status(200).json(buildSuccess(company));
  } catch (err) {
    next(err);
  }
});

router.patch("/companies/:id/subscription/renew", async (req, res, next) => {
  try {
    const companyId = uuidParamSchema.parse(req.params.id);
    const { periodDays } = renewSubscriptionSchema.parse(req.body ?? {});
    const company = await platformService.renewSubscription(companyId, periodDays);
    res.status(200).json(buildSuccess(company));
  } catch (err) {
    next(err);
  }
});

router.put("/companies/:id/addons/:addonCode", async (req, res, next) => {
  try {
    const companyId = uuidParamSchema.parse(req.params.id);
    const { addonCode } = addonParamsSchema.parse(req.params);
    const input = upsertAddonSchema.parse(req.body);
    const addon = await platformService.upsertAddon(companyId, addonCode, input);
    res.status(200).json(buildSuccess(addon));
  } catch (err) {
    next(err);
  }
});

export default router;

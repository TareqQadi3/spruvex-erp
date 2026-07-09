import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireModule } from "../../../core/middleware/subscription.middleware";
import { AppError } from "../../../core/errors/AppError";
import { buildPaginated, buildSuccess } from "../../../shared/utils/responseEnvelope";
import {
  businessSummarySchema,
  listUsageQuerySchema,
  productAssistantSchema,
  updateSettingsSchema,
} from "../validators/ai.validators";
import * as aiService from "../services/aiService";
import { aiRepository } from "../repositories/aiRepository";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireModule("ai_features"));

router.get("/settings", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const settings = await aiService.getSettings(req.tenant.companyId);
    res.status(200).json(buildSuccess(settings));
  } catch (err) {
    next(err);
  }
});

router.put("/settings", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const input = updateSettingsSchema.parse(req.body);
    const settings = await aiService.updateSettings(req.tenant.companyId, input);
    res.status(200).json(buildSuccess(settings));
  } catch (err) {
    next(err);
  }
});

router.post("/product-assistant", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const input = productAssistantSchema.parse(req.body);
    const result = await aiService.productAssistant(req.tenant.companyId, req.tenant.userId, input);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

router.post("/business-assistant/summary", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const { language } = businessSummarySchema.parse(req.body ?? {});
    const result = await aiService.businessSummary(req.tenant.companyId, req.tenant.userId, language);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

router.get("/usage", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const filters = listUsageQuerySchema.parse(req.query);
    const { rows, total } = await aiRepository.listUsageLogs(req.tenant.companyId, filters);
    res.status(200).json(buildPaginated(rows, { page: filters.page, pageSize: filters.pageSize, total }));
  } catch (err) {
    next(err);
  }
});

export default router;

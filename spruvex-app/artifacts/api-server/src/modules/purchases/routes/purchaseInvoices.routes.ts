import { Router, type IRouter } from "express";
import { PERMISSIONS } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import { AppError } from "../../../core/errors/AppError";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import { uuidParamSchema } from "../../../shared/validators/common.validators";
import {
  createOrGetPurchaseInvoiceFromPurchase,
  createOrGetPurchaseInvoiceFromReturn,
  getPurchaseInvoiceDetail,
} from "../services/purchaseInvoiceService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requirePermission(PERMISSIONS.MANAGE_ACCOUNTING));

router.post("/from-purchase/:purchaseId", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const purchaseId = uuidParamSchema.parse(req.params.purchaseId);
    const invoice = await createOrGetPurchaseInvoiceFromPurchase(req.tenant, purchaseId);
    res.status(201).json(buildSuccess(invoice));
  } catch (err) {
    next(err);
  }
});

router.post("/from-return/:returnId", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const returnId = uuidParamSchema.parse(req.params.returnId);
    const invoice = await createOrGetPurchaseInvoiceFromReturn(req.tenant, returnId);
    res.status(201).json(buildSuccess(invoice));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const id = uuidParamSchema.parse(req.params.id);
    const invoice = await getPurchaseInvoiceDetail(req.tenant.companyId, id);
    res.status(200).json(buildSuccess(invoice));
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router, type IRouter } from "express";
import { PERMISSIONS } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireModule } from "../../../core/middleware/subscription.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import { AppError } from "../../../core/errors/AppError";
import { buildPaginated, buildSuccess } from "../../../shared/utils/responseEnvelope";
import { uuidParamSchema } from "../../../shared/validators/common.validators";
import {
  createCheckoutSchema,
  listTransactionsQuerySchema,
  refundSchema,
  upsertGatewaySchema,
} from "../validators/payments.validators";
import * as paymentsService from "../services/paymentsService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireModule("payment_gateways"));

router.get("/gateways", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const gateways = await paymentsService.listGateways(req.tenant.companyId);
    res.status(200).json(buildSuccess(gateways));
  } catch (err) {
    next(err);
  }
});

router.put("/gateways/:provider", requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const input = upsertGatewaySchema.parse(req.body);
    const gateway = await paymentsService.upsertGateway(req.tenant, req.params.provider as string, input);
    res.status(200).json(buildSuccess(gateway));
  } catch (err) {
    next(err);
  }
});

router.post("/checkout", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const input = createCheckoutSchema.parse(req.body);
    const transaction = await paymentsService.createCheckout(req.tenant, input);
    res.status(201).json(buildSuccess(transaction));
  } catch (err) {
    next(err);
  }
});

router.get("/transactions", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const filters = listTransactionsQuerySchema.parse(req.query);
    const { rows, total } = await paymentsService.listTransactions(req.tenant.companyId, filters);
    res.status(200).json(buildPaginated(rows, { page: filters.page, pageSize: filters.pageSize, total }));
  } catch (err) {
    next(err);
  }
});

router.get("/transactions/:id", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const id = uuidParamSchema.parse(req.params.id);
    const transaction = await paymentsService.getTransaction(req.tenant, id);
    res.status(200).json(buildSuccess(transaction));
  } catch (err) {
    next(err);
  }
});

router.post("/transactions/:id/refresh", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const id = uuidParamSchema.parse(req.params.id);
    const transaction = await paymentsService.refreshTransaction(req.tenant, id);
    res.status(200).json(buildSuccess(transaction));
  } catch (err) {
    next(err);
  }
});

router.post("/transactions/:id/refund", requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const id = uuidParamSchema.parse(req.params.id);
    const { amount } = refundSchema.parse(req.body ?? {});
    const transaction = await paymentsService.refundTransaction(req.tenant, id, amount);
    res.status(200).json(buildSuccess(transaction));
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireModule } from "../../../core/middleware/subscription.middleware";
import { AppError } from "../../../core/errors/AppError";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import { biDateRangeQuerySchema, biLowStockQuerySchema } from "../validators/bi.validators";
import * as biService from "../services/biService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireModule("advanced_reports"));

// Defaults to the last 30 days ending now when from/to are omitted — the
// only place date-range defaulting happens (services/repository always
// require an explicit range from the caller).
function resolveRange(from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  const resolvedTo = to ? new Date(to.length <= 10 ? `${to}T23:59:59` : to) : now;
  const resolvedFrom = from
    ? new Date(from)
    : new Date(resolvedTo.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from: resolvedFrom, to: resolvedTo };
}

router.get("/summary", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const { from, to } = biDateRangeQuerySchema.parse(req.query);
    const { from: rangeFrom, to: rangeTo } = resolveRange(from, to);
    const result = await biService.getSalesProfitSummary(req.tenant.companyId, rangeFrom, rangeTo);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

router.get("/trend", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const { from, to } = biDateRangeQuerySchema.parse(req.query);
    const { from: rangeFrom, to: rangeTo } = resolveRange(from, to);
    const result = await biService.getSalesTrend(req.tenant.companyId, rangeFrom, rangeTo);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

router.get("/top-products", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const { from, to, limit } = biDateRangeQuerySchema.parse(req.query);
    const { from: rangeFrom, to: rangeTo } = resolveRange(from, to);
    const result = await biService.getTopProducts(req.tenant.companyId, rangeFrom, rangeTo, limit);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

router.get("/worst-products", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const { from, to, limit } = biDateRangeQuerySchema.parse(req.query);
    const { from: rangeFrom, to: rangeTo } = resolveRange(from, to);
    const result = await biService.getWorstProducts(req.tenant.companyId, rangeFrom, rangeTo, limit);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

router.get("/low-stock", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const { limit } = biLowStockQuerySchema.parse(req.query);
    const result = await biService.getLowStockProducts(req.tenant.companyId, limit);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

router.get("/top-customers", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const { from, to, limit } = biDateRangeQuerySchema.parse(req.query);
    const { from: rangeFrom, to: rangeTo } = resolveRange(from, to);
    const result = await biService.getTopCustomers(req.tenant.companyId, rangeFrom, rangeTo, limit);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

router.get("/branch-performance", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const { from, to } = biDateRangeQuerySchema.parse(req.query);
    const { from: rangeFrom, to: rangeTo } = resolveRange(from, to);
    const result = await biService.getBranchPerformance(req.tenant.companyId, rangeFrom, rangeTo);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

router.get("/user-performance", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const { from, to } = biDateRangeQuerySchema.parse(req.query);
    const { from: rangeFrom, to: rangeTo } = resolveRange(from, to);
    const result = await biService.getUserPerformance(req.tenant.companyId, rangeFrom, rangeTo);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

router.get("/expenses-breakdown", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const { from, to } = biDateRangeQuerySchema.parse(req.query);
    const { from: rangeFrom, to: rangeTo } = resolveRange(from, to);
    const result = await biService.getExpensesBreakdown(req.tenant.companyId, rangeFrom, rangeTo);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

router.get("/cashflow", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const { from, to } = biDateRangeQuerySchema.parse(req.query);
    const { from: rangeFrom, to: rangeTo } = resolveRange(from, to);
    const result = await biService.getCashflowSummary(req.tenant.companyId, rangeFrom, rangeTo);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

export default router;

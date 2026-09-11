import { Router, type IRouter } from "express";
import { PERMISSIONS } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import * as reportService from "../services/reportService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/inventory-valuation", async (req, res) => {
  res.json(await reportService.getInventoryValuation(req.tenant!.companyId));
});

router.get("/inventory-alerts", async (req, res) => {
  res.json(await reportService.getInventoryAlerts(req.tenant!.companyId));
});

router.get("/dashboard", async (req, res) => {
  res.json(await reportService.getDashboard(req.tenant!.companyId));
});

router.get("/sales-summary", requirePermission(PERMISSIONS.REPORTS_VIEW), async (req, res) => {
  const { from, to, branchId } = req.query;
  try {
    const rows = await reportService.getSalesSummary(req.tenant!, from as string | undefined, to as string | undefined, branchId as string | undefined);
    res.json(rows);
  } catch (err) {
    if (err instanceof reportService.MissingDateRangeError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.get("/top-products", requirePermission(PERMISSIONS.REPORTS_VIEW), async (req, res) => {
  const { limit, from, to, branchId } = req.query;
  const rows = await reportService.getTopProducts(
    req.tenant!, limit as string | undefined, from as string | undefined, to as string | undefined, branchId as string | undefined,
  );
  res.json(rows);
});

router.get("/repairs-summary", async (req, res) => {
  res.json(await reportService.getRepairsSummary(req.tenant!.companyId));
});

router.get("/profit", requirePermission(PERMISSIONS.REPORTS_VIEW), async (req, res) => {
  const { from, to, branchId } = req.query;
  try {
    const result = await reportService.getProfit(req.tenant!, from as string | undefined, to as string | undefined, branchId as string | undefined);
    res.json(result);
  } catch (err) {
    if (err instanceof reportService.MissingDateRangeError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;

import { Router, type IRouter } from "express";
import { PERMISSIONS } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import { requireModule } from "../../../core/middleware/subscription.middleware";
import {
  adjustStockHandler,
  commitStockDeductionHandler,
  getStockHandler,
  listStockMovementsHandler,
  reserveStockHandler,
  transferStockHandler,
} from "../controllers/inventoryController";

const router: IRouter = Router();

// requireModule("inventory") only adds the subscription-active check here in
// practice — "inventory" is in every plan's base module list (see
// PLAN_CATALOG), so this can never newly-block a legitimately active
// tenant; it closes a real gap where this router previously had no
// subscription-status check at all, unlike modules built with gating in
// mind (zatca/ai/ecommerce/payments/bi).
router.use(requireAuth, enforceTenantIsolation, requireModule("inventory"));

// Must precede /stock/:productId — otherwise "movements" would be parsed as a productId.
router.get("/stock/movements", listStockMovementsHandler);
router.get("/stock/:productId", getStockHandler);
router.post("/stock/adjust", requirePermission(PERMISSIONS.MANAGE_INVENTORY), adjustStockHandler);
router.post("/stock/transfer", requirePermission(PERMISSIONS.MANAGE_INVENTORY), transferStockHandler);
router.post("/stock/reserve", requirePermission(PERMISSIONS.MANAGE_INVENTORY), reserveStockHandler);
router.post("/stock/commit", requirePermission(PERMISSIONS.MANAGE_INVENTORY), commitStockDeductionHandler);

export default router;

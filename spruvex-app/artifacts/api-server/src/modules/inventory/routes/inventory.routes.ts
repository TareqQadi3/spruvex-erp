import { Router, type IRouter } from "express";
import { PERMISSIONS } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import {
  adjustStockHandler,
  commitStockDeductionHandler,
  getStockHandler,
  listStockMovementsHandler,
  reserveStockHandler,
  transferStockHandler,
} from "../controllers/inventoryController";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation);

// Must precede /stock/:productId — otherwise "movements" would be parsed as a productId.
router.get("/stock/movements", listStockMovementsHandler);
router.get("/stock/:productId", getStockHandler);
router.post("/stock/adjust", requirePermission(PERMISSIONS.MANAGE_INVENTORY), adjustStockHandler);
router.post("/stock/transfer", requirePermission(PERMISSIONS.MANAGE_INVENTORY), transferStockHandler);
router.post("/stock/reserve", requirePermission(PERMISSIONS.MANAGE_INVENTORY), reserveStockHandler);
router.post("/stock/commit", requirePermission(PERMISSIONS.MANAGE_INVENTORY), commitStockDeductionHandler);

export default router;

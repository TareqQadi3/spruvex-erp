import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { createSaleHandler } from "../controllers/saleController";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation);

router.post("/", createSaleHandler);

export default router;

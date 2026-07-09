import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { pullHandler, pushHandler, statusHandler } from "../controllers/syncController";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation);

router.post("/push", pushHandler);
router.get("/pull", pullHandler);
router.get("/status/:deviceId", statusHandler);

export default router;

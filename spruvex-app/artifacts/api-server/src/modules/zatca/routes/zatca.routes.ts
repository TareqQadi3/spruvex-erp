import { Router, type IRouter } from "express";
import { PERMISSIONS } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import {
  createInvoiceHandler,
  generateQrHandler,
  generateXmlHandler,
  getInvoiceHandler,
  signInvoiceHandler,
  submitHandler,
} from "../controllers/zatcaController";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requirePermission(PERMISSIONS.MANAGE_ACCOUNTING));

router.post("/invoices", createInvoiceHandler);
router.get("/invoices/:id", getInvoiceHandler);
router.post("/invoices/:id/xml", generateXmlHandler);
router.post("/invoices/:id/sign", signInvoiceHandler);
router.post("/invoices/:id/qr", generateQrHandler);
router.post("/invoices/:id/submit", submitHandler);

export default router;

import { Router, type IRouter } from "express";
import { PERMISSIONS } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import {
  createCreditNoteHandler,
  createInvoiceHandler,
  generateQrHandler,
  generateXmlHandler,
  getInvoiceHandler,
  getOrCreateInvoiceForSaleHandler,
  signInvoiceHandler,
  submitHandler,
} from "../controllers/zatcaController";

const router: IRouter = Router();

// requireActiveSubscription is the status-only gate (suspended/expired/
// cancelled tenants are blocked). ZATCA is a compliance obligation rather
// than a paid add-on, so the module-membership variant (requireModule) does
// not apply here. Mounted at the router level because this router only ever
// receives /api/zatca/* requests — nothing broader leaks through it.
router.use(
  requireAuth,
  enforceTenantIsolation,
  requirePermission(PERMISSIONS.MANAGE_ACCOUNTING),
  requireActiveSubscription(),
);

router.post("/invoices", createInvoiceHandler);
router.post("/invoices/from-return", createCreditNoteHandler);
router.post("/invoices/for-sale/:saleId", getOrCreateInvoiceForSaleHandler);
router.get("/invoices/:id", getInvoiceHandler);
router.post("/invoices/:id/xml", generateXmlHandler);
router.post("/invoices/:id/sign", signInvoiceHandler);
router.post("/invoices/:id/qr", generateQrHandler);
router.post("/invoices/:id/submit", submitHandler);

export default router;

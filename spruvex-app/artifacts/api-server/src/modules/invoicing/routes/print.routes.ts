import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { AppError } from "../../../core/errors/AppError";
import { uuidParamSchema } from "../../../shared/validators/common.validators";
import { printQuerySchema } from "../validators/invoicing.validators";
import { assemblePurchasePrintData, assembleSalesPrintData } from "../services/documentAssembler";
import * as templateService from "../services/templateService";
import { renderInvoiceHtml } from "../services/renderer";

const router: IRouter = Router();

// Print endpoints are meant to be opened directly in a browser tab/window, so
// they return raw HTML (not the JSON envelope) and only require an
// authenticated staff member — no extra permission, any staff can print.
router.use(requireAuth, enforceTenantIsolation);

router.get("/sales/:invoiceId", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const invoiceId = uuidParamSchema.parse(req.params.invoiceId);
    const { printType, templateId } = printQuerySchema.parse(req.query);

    const data = await assembleSalesPrintData(req.tenant.companyId, invoiceId);
    const template = await templateService.resolveTemplate(req.tenant.companyId, "sales", printType, templateId);
    const html = await renderInvoiceHtml(data, printType, template.config);

    res.status(200).type("html").send(html);
  } catch (err) {
    next(err);
  }
});

router.get("/purchases/:purchaseInvoiceId", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const purchaseInvoiceId = uuidParamSchema.parse(req.params.purchaseInvoiceId);
    const { printType, templateId } = printQuerySchema.parse(req.query);

    const data = await assemblePurchasePrintData(req.tenant.companyId, purchaseInvoiceId);
    const template = await templateService.resolveTemplate(req.tenant.companyId, "purchase", printType, templateId);
    const html = await renderInvoiceHtml(data, printType, template.config);

    res.status(200).type("html").send(html);
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import * as installmentSaleService from "../services/installmentSaleService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/", async (req, res) => {
  const saleId = req.query.saleId as string | undefined;
  res.json(await installmentSaleService.listInstallmentSales(req.tenant!.companyId, saleId));
});

router.post("/", async (req, res) => {
  try {
    const result = await installmentSaleService.createInstallmentSale(req.tenant!.companyId, req.body);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof installmentSaleService.NotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create installment sale" });
  }
});

router.get("/:id", async (req, res) => {
  const result = await installmentSaleService.getInstallmentSale(req.tenant!.companyId, req.params.id as string);
  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(result);
});

router.post("/:id/payments/:paymentId/pay", async (req, res) => {
  try {
    const updated = await installmentSaleService.payInstallment(req.tenant!.companyId, req.params.id as string, req.params.paymentId as string);
    res.json(updated);
  } catch (err) {
    if (err instanceof installmentSaleService.NotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof installmentSaleService.AlreadyPaidError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;

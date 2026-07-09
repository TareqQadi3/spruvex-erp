import { Router } from "express";
import type { AuthedRequest } from "../../../lib/auth-middleware";
import * as purchaseService from "../services/purchaseService";
import * as purchaseReturnService from "../services/purchaseReturnService";

const router = Router();

router.get("/", async (req: AuthedRequest, res) => {
  const productId = req.query.productId as string | undefined;
  const purchases = await purchaseService.listPurchases(req.user!.companyId, productId);
  res.json(purchases);
});

router.post("/", async (req: AuthedRequest, res) => {
  try {
    const purchase = await purchaseService.createPurchase(req.user!.companyId, req.body);
    res.status(201).json(purchase);
  } catch (err) {
    if (err instanceof purchaseService.PurchaseValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof purchaseService.PurchaseNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.get("/:id/returns", async (req: AuthedRequest, res) => {
  const returns = await purchaseReturnService.getPurchaseReturns(req.user!.companyId, req.params.id as string);
  res.json(returns);
});

router.post("/:id/returns", async (req: AuthedRequest, res) => {
  try {
    const result = await purchaseReturnService.createPurchaseReturn(req.user!.companyId, req.params.id as string, req.body);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof purchaseReturnService.PurchaseReturnValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;

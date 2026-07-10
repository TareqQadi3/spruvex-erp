import { Router } from "express";
import type { AuthedRequest } from "../../../lib/auth-middleware";
import * as salesService from "../services/salesService";

const router = Router();

router.get("/", async (req: AuthedRequest, res) => {
  const { from, to, customerId } = req.query;
  const sales = await salesService.listSales(req.user!.companyId, {
    from: from as string | undefined,
    to: to as string | undefined,
    customerId: customerId as string | undefined,
  });
  res.json(sales);
});

router.post("/", async (req: AuthedRequest, res) => {
  try {
    const sale = await salesService.createSale(req.user!.companyId, req.body, req.user!.id);
    res.status(201).json(sale);
  } catch (err) {
    if (err instanceof salesService.SaleValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const sale = await salesService.getSaleWithDetails(req.user!.companyId, req.params.id as string);
  if (!sale) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(sale);
});

router.get("/:id/returns", async (req: AuthedRequest, res) => {
  const returns = await salesService.getSaleReturns(req.user!.companyId, req.params.id as string);
  res.json(returns);
});

router.post("/:id/returns", async (req: AuthedRequest, res) => {
  try {
    const result = await salesService.createSaleReturn(req.user!.companyId, req.params.id as string, req.body);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof salesService.SaleValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;

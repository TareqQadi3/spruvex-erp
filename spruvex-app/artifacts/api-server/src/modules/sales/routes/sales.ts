import { Router } from "express";
import { PERMISSIONS } from "@workspace/db";
import { requirePermission, type AuthedRequest } from "../../../lib/auth-middleware";
import * as salesService from "../services/salesService";
import { logAudit } from "../../auditLog/auditLogService";

const router = Router();

router.get("/", async (req: AuthedRequest, res) => {
  const { from, to, customerId, status, cashSessionId } = req.query;
  const sales = await salesService.listSales(req.user!.companyId, {
    from: from as string | undefined,
    to: to as string | undefined,
    customerId: customerId as string | undefined,
    status: status as string | undefined,
    cashSessionId: cashSessionId as string | undefined,
  });
  res.json(sales);
});

router.post("/", requirePermission(PERMISSIONS.SALES_CREATE), async (req: AuthedRequest, res) => {
  try {
    const sale = await salesService.createSale(req.user!.companyId, req.body, req.user!.id, req.user!.branchId);
    await logAudit({
      companyId: req.user!.companyId, userId: req.user!.id, action: "create_sale",
      entityType: "sale", entityId: sale.id, newValue: { total: sale.total, paymentMethod: sale.paymentMethod },
    });
    res.status(201).json(sale);
  } catch (err) {
    if (err instanceof salesService.SaleValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// Literal "/returns" must be registered before "/:id" so it isn't captured as a sale id.
router.get("/returns", async (req: AuthedRequest, res) => {
  const { from, to } = req.query;
  const returns = await salesService.listSaleReturns(req.user!.companyId, {
    from: from as string | undefined,
    to: to as string | undefined,
  });
  res.json(returns);
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

router.patch("/:id", requirePermission(PERMISSIONS.SALES_CREATE), async (req: AuthedRequest, res) => {
  try {
    const sale = await salesService.updateDraftSale(req.user!.companyId, req.params.id as string, req.body);
    await logAudit({
      companyId: req.user!.companyId, userId: req.user!.id, action: "update_sale",
      entityType: "sale", entityId: sale.id,
    });
    res.json(sale);
  } catch (err) {
    if (err instanceof salesService.SaleValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post("/:id/approve", requirePermission(PERMISSIONS.SALES_CREATE), async (req: AuthedRequest, res) => {
  try {
    const sale = await salesService.approveSale(req.user!.companyId, req.params.id as string, req.body);
    await logAudit({
      companyId: req.user!.companyId, userId: req.user!.id, action: "approve_sale",
      entityType: "sale", entityId: sale.id, newValue: { status: sale.status },
    });
    res.json(sale);
  } catch (err) {
    if (err instanceof salesService.SaleValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post("/:id/payments", requirePermission(PERMISSIONS.SALES_CREATE), async (req: AuthedRequest, res) => {
  try {
    const sale = await salesService.recordSalePayment(req.user!.companyId, req.params.id as string, req.body);
    await logAudit({
      companyId: req.user!.companyId, userId: req.user!.id, action: "record_sale_payment",
      entityType: "sale", entityId: sale.id, newValue: { amountPaid: sale.amountPaid, status: sale.status },
    });
    res.json(sale);
  } catch (err) {
    if (err instanceof salesService.SaleValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.delete("/:id", requirePermission(PERMISSIONS.SALES_CANCEL), async (req: AuthedRequest, res) => {
  try {
    await salesService.deleteDraftSale(req.user!.companyId, req.params.id as string);
    await logAudit({
      companyId: req.user!.companyId, userId: req.user!.id, action: "delete_sale",
      entityType: "sale", entityId: req.params.id as string,
    });
    res.json({ success: true });
  } catch (err) {
    if (err instanceof salesService.SaleValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;

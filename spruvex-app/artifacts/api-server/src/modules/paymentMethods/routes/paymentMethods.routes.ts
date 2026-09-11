import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import * as paymentMethodService from "../services/paymentMethodService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/", async (req, res) => {
  res.json(await paymentMethodService.listPaymentMethods(db, req.tenant!.companyId));
});

router.post("/", async (req, res) => {
  try {
    const method = await paymentMethodService.createPaymentMethod(db, req.tenant!.companyId, req.body);
    res.status(201).json(method);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create payment method" });
  }
});

router.put("/:id", async (req, res) => {
  const updated = await paymentMethodService.updatePaymentMethod(db, req.tenant!.companyId, req.params.id as string, req.body);
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  await paymentMethodService.deletePaymentMethod(db, req.tenant!.companyId, req.params.id as string);
  res.status(204).send();
});

export default router;

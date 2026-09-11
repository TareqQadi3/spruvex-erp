import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import { ValidationError } from "../../../lib/validation";
import { logAudit } from "../../auditLog/auditLogService";
import * as repairPartService from "../services/repairPartService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/", async (req, res) => {
  const { repairId } = req.query;
  if (!repairId) {
    res.status(400).json({ error: "repairId is required" });
    return;
  }
  const parts = await repairPartService.listRepairParts(req.tenant!.companyId, repairId as string);
  res.json(parts);
});

router.post("/", async (req, res) => {
  const companyId = req.tenant!.companyId;
  try {
    const part = await repairPartService.createRepairPart(companyId, req.body);

    await logAudit({
      companyId,
      userId: req.tenant!.userId,
      action: "add_repair_part",
      entityType: "repair_part",
      entityId: part.id,
      newValue: { repairId: req.body.repairId, partName: req.body.partName, quantity: part.quantity, productId: part.productId },
    });

    res.status(201).json(part);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.put("/:id", async (req, res) => {
  const id = req.params.id as string;
  try {
    const updated = await repairPartService.updateRepairPart(req.tenant!.companyId, id, req.body);
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.delete("/:id", async (req, res) => {
  const id = req.params.id as string;
  const companyId = req.tenant!.companyId;

  await repairPartService.deleteRepairPart(companyId, id);

  await logAudit({
    companyId,
    userId: req.tenant!.userId,
    action: "delete_repair_part",
    entityType: "repair_part",
    entityId: id,
  });

  res.status(204).send();
});

export default router;

import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import * as warehouseService from "../services/warehouseService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/sections", async (req, res) => {
  const warehouseId = req.query.warehouseId as string | undefined;
  res.json(await warehouseService.listWarehouseSections(req.tenant!.companyId, warehouseId));
});

router.post("/sections", async (req, res) => {
  try {
    const section = await warehouseService.createWarehouseSection(req.tenant!.companyId, req.body);
    res.status(201).json(section);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create section" });
  }
});

router.delete("/sections/:id", async (req, res) => {
  await warehouseService.deleteWarehouseSection(req.tenant!.companyId, req.params.id as string);
  res.status(204).send();
});

router.get("/", async (req, res) => {
  const branchId = req.query.branchId as string | undefined;
  res.json(await warehouseService.listWarehouses(req.tenant!.companyId, branchId));
});

router.post("/", async (req, res) => {
  try {
    const warehouse = await warehouseService.createWarehouse(req.tenant!.companyId, req.body);
    res.status(201).json(warehouse);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create warehouse" });
  }
});

router.put("/:id", async (req, res) => {
  const warehouse = await warehouseService.updateWarehouse(req.tenant!.companyId, req.params.id as string, req.body);
  if (!warehouse) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(warehouse);
});

router.delete("/:id", async (req, res) => {
  await warehouseService.deleteWarehouse(req.tenant!.companyId, req.params.id as string);
  res.status(204).send();
});

export default router;

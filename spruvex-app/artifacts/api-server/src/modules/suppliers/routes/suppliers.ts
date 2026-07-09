import { Router } from "express";
import { db } from "@workspace/db";
import type { AuthedRequest } from "../../../lib/auth-middleware";
import * as supplierService from "../services/supplierService";

const router = Router();

router.get("/", async (req: AuthedRequest, res) => {
  const suppliers = await supplierService.listSuppliers(db, req.user!.companyId, req.query.search as string | undefined);
  res.json(suppliers);
});

router.post("/", async (req: AuthedRequest, res) => {
  try {
    const supplier = await supplierService.createSupplier(db, req.user!.companyId, req.body);
    res.status(201).json(supplier);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create supplier" });
  }
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const supplier = await supplierService.updateSupplier(db, req.user!.companyId, req.params.id as string, req.body);
  if (!supplier) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(supplier);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  await supplierService.deleteSupplier(db, req.user!.companyId, req.params.id as string);
  res.status(204).send();
});

export default router;

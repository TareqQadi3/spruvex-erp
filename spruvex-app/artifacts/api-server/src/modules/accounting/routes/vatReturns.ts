import { Router } from "express";
import { PERMISSIONS } from "@workspace/db";
import { requirePermission, type AuthedRequest } from "../../../lib/auth-middleware";
import * as vatReturnService from "../services/vatReturnService";

const router = Router();

router.use(requirePermission(PERMISSIONS.MANAGE_ACCOUNTING));

router.get("/", async (req: AuthedRequest, res) => {
  const rows = await vatReturnService.listVatReturns(req.user!.companyId);
  res.json(rows);
});

router.post("/generate", async (req: AuthedRequest, res) => {
  try {
    const vatReturn = await vatReturnService.generateVatReturn(req.user!.companyId, req.body);
    res.status(201).json(vatReturn);
  } catch (err) {
    if (err instanceof vatReturnService.InvalidPeriodError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const vatReturn = await vatReturnService.getVatReturn(req.user!.companyId, req.params.id as string);
  if (!vatReturn) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(vatReturn);
});

router.get("/:id/export", async (req: AuthedRequest, res) => {
  const vatReturn = await vatReturnService.getVatReturn(req.user!.companyId, req.params.id as string);
  if (!vatReturn) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="vat-return-${vatReturn.periodStart}-${vatReturn.periodEnd}.csv"`);
  res.send(vatReturnService.toCsv(vatReturn));
});

router.post("/:id/finalize", async (req: AuthedRequest, res) => {
  const updated = await vatReturnService.finalizeVatReturn(req.user!.companyId, req.params.id as string, req.user!.id);
  if (!updated) {
    res.status(404).json({ error: "Not found, or already finalized" });
    return;
  }
  res.json(updated);
});

export default router;

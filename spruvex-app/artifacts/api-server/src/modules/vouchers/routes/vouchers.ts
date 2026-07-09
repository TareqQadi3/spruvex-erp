import { Router } from "express";
import type { AuthedRequest } from "../../../lib/auth-middleware";
import * as voucherService from "../services/voucherService";

const router = Router();

router.get("/", async (req: AuthedRequest, res) => {
  const { type, from, to } = req.query;
  const vouchers = await voucherService.listVouchers(req.user!.companyId, {
    type: type as string | undefined,
    from: from as string | undefined,
    to: to as string | undefined,
  });
  res.json(vouchers);
});

router.post("/", async (req: AuthedRequest, res) => {
  try {
    const voucher = await voucherService.createVoucher(req.user!.companyId, req.body);
    res.status(201).json(voucher);
  } catch (err) {
    if (err instanceof voucherService.VoucherValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  await voucherService.deleteVoucher(req.user!.companyId, req.params.id as string);
  res.status(204).send();
});

export default router;

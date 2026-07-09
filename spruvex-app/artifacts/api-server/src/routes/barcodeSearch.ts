import { Router } from "express";
import { db, productsTable, repairsTable, vouchersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";

const router = Router();

// One scan box, three possible destinations. Tries each known barcode-shaped
// identifier in turn and reports which kind matched (or 404 if none did) so the
// frontend can navigate straight to the right page without the user searching.
router.get("/:code", async (req: AuthedRequest, res) => {
  const orgId = req.user!.companyId;
  const code = String(req.params.code);

  const [product] = await db.select({ id: productsTable.id }).from(productsTable)
    .where(and(eq(productsTable.barcode, code), eq(productsTable.companyId, orgId)));
  if (product) {
    res.json({ type: "product", id: product.id });
    return;
  }

  const [repair] = await db.select({ id: repairsTable.id }).from(repairsTable)
    .where(and(eq(repairsTable.ticketNumber, code), eq(repairsTable.companyId, orgId)));
  if (repair) {
    res.json({ type: "repair", id: repair.id });
    return;
  }

  const [voucher] = await db.select({ id: vouchersTable.id }).from(vouchersTable)
    .where(and(eq(vouchersTable.voucherNumber, code), eq(vouchersTable.companyId, orgId)));
  if (voucher) {
    res.json({ type: "voucher", id: voucher.id });
    return;
  }

  res.status(404).json({ error: "No product, repair ticket, or voucher matches this code" });
});

export default router;

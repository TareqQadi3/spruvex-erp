import { eq, and } from "drizzle-orm";
import { productsTable, repairsTable, vouchersTable } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export type BarcodeMatch = { type: "product" | "repair" | "voucher"; id: string } | null;

// One scan box, three possible destinations. Tries each known barcode-shaped
// identifier in turn and reports which kind matched (or null if none did) so
// the frontend can navigate straight to the right page without the user
// searching.
export async function searchByCode(db: DbClient, companyId: string, code: string): Promise<BarcodeMatch> {
  const [product] = await db.select({ id: productsTable.id }).from(productsTable)
    .where(and(eq(productsTable.barcode, code), eq(productsTable.companyId, companyId)));
  if (product) return { type: "product", id: product.id };

  const [repair] = await db.select({ id: repairsTable.id }).from(repairsTable)
    .where(and(eq(repairsTable.ticketNumber, code), eq(repairsTable.companyId, companyId)));
  if (repair) return { type: "repair", id: repair.id };

  const [voucher] = await db.select({ id: vouchersTable.id }).from(vouchersTable)
    .where(and(eq(vouchersTable.voucherNumber, code), eq(vouchersTable.companyId, companyId)));
  if (voucher) return { type: "voucher", id: voucher.id };

  return null;
}

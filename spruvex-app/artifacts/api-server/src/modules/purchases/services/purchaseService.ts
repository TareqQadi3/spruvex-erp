import { db, type Purchase } from "@workspace/db";
import { purchaseRepository } from "../repositories/purchaseRepository";
import { recordPurchaseDebt } from "../../suppliers/services/supplierService";
import { postPurchaseEntry } from "../../accounting";
import { parseRequiredNumber, ValidationError } from "../../../lib/validation";

export interface CreatePurchaseInput {
  productId: string;
  supplierId: string;
  quantity: number;
  totalCost: number;
  amountPaid?: number;
}

class PurchaseValidationError extends Error {}
class PurchaseNotFoundError extends Error {}

export async function listPurchases(companyId: string, productId?: string) {
  return purchaseRepository.list(db, companyId, productId);
}

// Stock-in + supplier debt + ledger entry, all atomic — mirrors the transaction this
// route already had before the accounting integration, just relayered.
export async function createPurchase(companyId: string, input: CreatePurchaseInput): Promise<Purchase> {
  const { productId, supplierId, quantity, totalCost, amountPaid } = input;
  if (!productId || !supplierId || !quantity || totalCost === undefined) {
    throw new PurchaseValidationError("productId, supplierId, quantity and totalCost are required");
  }
  let qty: number, cost: number, paid: number;
  try {
    qty = parseRequiredNumber(quantity, "quantity");
    cost = parseRequiredNumber(totalCost, "totalCost");
    paid = parseRequiredNumber(amountPaid ?? 0, "amountPaid");
  } catch (err) {
    if (err instanceof ValidationError) throw new PurchaseValidationError(err.message);
    throw err;
  }
  if (qty <= 0 || cost < 0 || paid < 0) {
    throw new PurchaseValidationError("Invalid quantity, totalCost or amountPaid");
  }
  const remaining = cost - paid;

  return db.transaction(async (tx) => {
    const product = await purchaseRepository.findProduct(tx, companyId, productId);
    if (!product) throw new PurchaseNotFoundError("Product or supplier not found");
    const supplier = await purchaseRepository.findSupplier(tx, companyId, supplierId);
    if (!supplier) throw new PurchaseNotFoundError("Product or supplier not found");

    const purchase = await purchaseRepository.insert(tx, {
      companyId,
      productId,
      supplierId,
      quantity: qty,
      totalCost: cost.toString(),
      amountPaid: paid.toString(),
    });

    await purchaseRepository.adjustProductStock(tx, productId, qty, supplierId);
    await recordPurchaseDebt(tx, companyId, supplierId, remaining);

    await postPurchaseEntry(tx, {
      companyId,
      purchaseId: purchase.id,
      date: purchase.createdAt.toISOString().split("T")[0],
      totalCost: cost,
      amountPaid: paid,
    });

    return purchase;
  });
}

export { PurchaseValidationError, PurchaseNotFoundError };

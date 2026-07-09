import { db } from "@workspace/db";
import { purchaseRepository } from "../repositories/purchaseRepository";
import { settleOutstandingBalance } from "../../suppliers/services/supplierService";
import { postPurchaseReturnEntry } from "../../accounting";

export class PurchaseReturnValidationError extends Error {}

export interface CreatePurchaseReturnInput {
  quantity: number;
  reason?: string;
  refundMethod?: "cash" | "credit_note";
}

// Reverses part or all of a single purchase: restores the cost to the supplier
// balance or cash, reverses the inventory it added, and posts a matching journal
// entry — all inside one transaction so a failure anywhere rolls back everything.
export async function createPurchaseReturn(companyId: string, purchaseId: string, input: CreatePurchaseReturnInput) {
  const quantity = Number(input.quantity);
  if (!quantity || quantity <= 0) {
    throw new PurchaseReturnValidationError("quantity must be greater than zero");
  }
  const refundMethod: "cash" | "credit_note" = input.refundMethod === "cash" ? "cash" : "credit_note";

  return db.transaction(async (tx) => {
    const purchase = await purchaseRepository.findById(tx, companyId, purchaseId);
    if (!purchase) throw new PurchaseReturnValidationError("Purchase not found");

    const available = purchase.quantity - (purchase.returnedQuantity ?? 0);
    if (quantity > available) {
      throw new PurchaseReturnValidationError(`Cannot return ${quantity} unit(s) — only ${available} available to return`);
    }

    const unitCost = Number(purchase.totalCost) / purchase.quantity;
    const amount = unitCost * quantity;

    await purchaseRepository.adjustProductStock(tx, purchase.productId, -quantity, purchase.supplierId);
    await purchaseRepository.incrementReturnedQuantity(tx, companyId, purchaseId, quantity);

    if (refundMethod === "credit_note") {
      await settleOutstandingBalance(tx, companyId, purchase.supplierId, amount);
    }

    const ret = await purchaseRepository.insertReturn(tx, {
      companyId,
      purchaseId,
      returnNumber: `PRET-${Date.now()}`,
      reason: input.reason,
      quantity,
      unitCost: unitCost.toString(),
      totalAmount: amount.toString(),
    });

    await postPurchaseReturnEntry(tx, {
      companyId,
      returnId: ret.id,
      date: new Date().toISOString().split("T")[0],
      amount,
      refundMethod,
    });

    return ret;
  });
}

export async function getPurchaseReturns(companyId: string, purchaseId: string) {
  return purchaseRepository.getReturnsForPurchase(db, companyId, purchaseId);
}

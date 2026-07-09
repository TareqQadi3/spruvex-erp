import { db, type Sale } from "@workspace/db";
import { salesRepository, type SaleListFilters } from "../repositories/salesRepository";
import { recordPurchaseOnAccount, settleOutstandingBalance } from "../../customers/services/customerService";
import { postSaleEntry, postSaleReturnEntry } from "../../accounting";
import { parseRequiredNumber, parseOptionalNumber, ValidationError } from "../../../lib/validation";

export interface SaleItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export interface SalePaymentInput {
  methodName: string;
  paymentMethodId?: string;
  amount: number;
}

export interface CreateSaleInput {
  customerId?: string;
  items: SaleItemInput[];
  discount?: number;
  paymentMethod?: string;
  paymentMethodId?: string;
  amountPaid?: number;
  payments?: SalePaymentInput[];
  notes?: string;
  cashSessionId?: string;
}

class SaleValidationError extends Error {}

export async function listSales(companyId: string, filters: SaleListFilters) {
  return salesRepository.list(db, companyId, filters);
}

export async function getSaleWithDetails(companyId: string, id: string) {
  const sale = await salesRepository.findById(db, companyId, id);
  if (!sale) return undefined;
  const [items, payments] = await Promise.all([
    salesRepository.getItems(db, companyId, id),
    salesRepository.getPayments(db, companyId, id),
  ]);
  return { ...sale, items, payments };
}

// The whole sale — header, items, stock, customer balance, cash session, and its
// journal entry — commits or rolls back as one unit. A ledger-posting failure must
// undo the stock decrement and balance changes, not leave them half-applied.
export async function createSale(companyId: string, input: CreateSaleInput) {
  if (!input.items || input.items.length === 0) {
    throw new SaleValidationError("items are required");
  }

  const isSplit = Array.isArray(input.payments) && input.payments.length > 0;
  if (isSplit) {
    for (const p of input.payments!) {
      if (typeof p.amount !== "number" || p.amount < 0 || !p.methodName) {
        throw new SaleValidationError("Each payment requires a methodName and a non-negative amount");
      }
    }
  }

  return db.transaction(async (tx) => {
    let subtotal = 0;
    const resolvedItems: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; discount: number; subtotal: number; costPrice: number }> = [];

    for (const item of input.items) {
      let quantity: number, unitPrice: number, discount: number;
      try {
        quantity = parseRequiredNumber(item.quantity, "quantity");
        unitPrice = parseRequiredNumber(item.unitPrice, "unitPrice");
        discount = parseOptionalNumber(item.discount, "discount") ?? 0;
      } catch (err) {
        if (err instanceof ValidationError) throw new SaleValidationError(err.message);
        throw err;
      }
      if (quantity <= 0) throw new SaleValidationError("quantity must be greater than zero");

      const product = await salesRepository.findProduct(tx, companyId, item.productId);
      if (!product) throw new SaleValidationError(`Product ${item.productId} not found`);
      if (product.stock < quantity) throw new SaleValidationError(`Insufficient stock for ${product.name}`);
      const itemSubtotal = unitPrice * quantity - discount;
      subtotal += itemSubtotal;
      resolvedItems.push({
        productId: item.productId,
        productName: product.name,
        quantity,
        unitPrice,
        discount,
        subtotal: itemSubtotal,
        costPrice: Number(product.costPrice),
      });
    }

    const goodsTotal = subtotal - (input.discount ?? 0);

    // Each payment method can carry its own percentage and/or fixed fee. For a single
    // method it's computed on the goods total; for a split sale each line's fee is
    // computed on that line's own amount and summed, so a fee-bearing method only
    // costs extra on the portion actually charged to it.
    let paymentFee = 0;
    if (isSplit) {
      for (const p of input.payments!) {
        if (!p.paymentMethodId) continue;
        const method = await salesRepository.findPaymentMethod(tx, companyId, p.paymentMethodId);
        if (method) paymentFee += p.amount * (parseFloat(method.percentFee) / 100) + parseFloat(method.fixedFee);
      }
    } else if (input.paymentMethodId) {
      const method = await salesRepository.findPaymentMethod(tx, companyId, input.paymentMethodId);
      if (method) paymentFee = goodsTotal * (parseFloat(method.percentFee) / 100) + parseFloat(method.fixedFee);
    }

    const total = goodsTotal + paymentFee;

    let paidTotal = input.amountPaid ?? total;
    if (isSplit) paidTotal = input.payments!.reduce((sum, p) => sum + p.amount, 0);
    const shortfall = Math.max(total - paidTotal, 0);

    // An unpaid balance (whether from a split or a single payment that fell short,
    // e.g. because a fee pushed the total above what was collected) can only be
    // recorded against a customer — a walk-in sale has nowhere to attribute it, and
    // silently dropping it would post an unbalanced AR entry with no customer.
    if (shortfall > 0 && !input.customerId) {
      throw new SaleValidationError("A customer must be selected to record the unpaid balance of this sale");
    }

    const change = Math.max(paidTotal - total, 0);

    const sale = await salesRepository.insertSale(tx, {
      companyId,
      customerId: input.customerId,
      cashSessionId: input.cashSessionId,
      subtotal: subtotal.toString(),
      discount: (input.discount ?? 0).toString(),
      total: total.toString(),
      paymentFee: paymentFee.toString(),
      amountPaid: paidTotal.toString(),
      change: change.toString(),
      paymentMethod: isSplit ? "mixed" : input.paymentMethod,
      paymentMethodId: input.paymentMethodId,
      status: "completed",
      notes: input.notes,
    });

    if (isSplit) {
      for (const p of input.payments!) {
        await salesRepository.insertPayment(tx, {
          companyId,
          saleId: sale.id,
          paymentMethodId: p.paymentMethodId ?? null,
          methodName: p.methodName,
          amount: p.amount.toString(),
        });
      }
    }

    let cogsTotal = 0;
    for (const item of resolvedItems) {
      await salesRepository.insertItem(tx, {
        companyId,
        saleId: sale.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        discount: item.discount.toString(),
        subtotal: item.subtotal.toString(),
      });
      await salesRepository.adjustProductStock(tx, companyId, item.productId, -item.quantity);
      cogsTotal += item.costPrice * item.quantity;
    }

    if (input.customerId) {
      await recordPurchaseOnAccount(tx, companyId, input.customerId, shortfall);
    }

    if (input.cashSessionId) {
      await salesRepository.incrementCashSessionTotal(tx, companyId, input.cashSessionId, total);
    }

    await postSaleEntry(tx, {
      companyId,
      saleId: sale.id,
      date: sale.createdAt.toISOString().split("T")[0],
      total,
      shortfall,
      cogsTotal,
      paymentFee,
    });

    return { ...sale, customerName: null, outstandingAdded: shortfall };
  });
}

export interface SaleReturnItemInput { saleItemId: string; quantity: number }
export interface SaleExchangeItemInput { productId: string; quantity: number; unitPrice: number }
export interface CreateSaleReturnInput {
  items: SaleReturnItemInput[];
  exchangeItems?: SaleExchangeItemInput[];
  reason?: string;
  refundMethod?: "cash" | "store_credit";
}

// Full return = items array covering every unit still returnable on the sale;
// partial = a subset. Exchange items (new products handed to the customer) are
// optional and net against the refund in the same transaction and journal entry.
export async function createSaleReturn(companyId: string, saleId: string, input: CreateSaleReturnInput) {
  if (!input.items || input.items.length === 0) {
    throw new SaleValidationError("At least one returned item is required");
  }
  const refundMethod: "cash" | "store_credit" = input.refundMethod === "store_credit" ? "store_credit" : "cash";

  return db.transaction(async (tx) => {
    const sale = await salesRepository.findRawById(tx, companyId, saleId);
    if (!sale) throw new SaleValidationError("Sale not found");

    const returnNumber = `RET-${Date.now()}`;
    const ret = await salesRepository.insertReturn(tx, {
      companyId, saleId, returnNumber,
      reason: input.reason, refundMethod,
      refundAmount: "0", exchangeAmount: "0", netAmount: "0",
    });

    let refundAmount = 0;
    let cogsReversal = 0;

    for (const ri of input.items) {
      if (!ri.quantity || ri.quantity <= 0) throw new SaleValidationError("Return quantity must be greater than zero");
      const item = await salesRepository.findItemById(tx, companyId, ri.saleItemId);
      if (!item || item.saleId !== saleId) {
        throw new SaleValidationError(`Sale item ${ri.saleItemId} does not belong to this sale`);
      }
      const available = item.quantity - (item.returnedQuantity ?? 0);
      if (ri.quantity > available) {
        throw new SaleValidationError(`Cannot return ${ri.quantity} of "${item.productName}" — only ${available} unit(s) available to return`);
      }

      const unitNet = Number(item.subtotal) / item.quantity;
      const lineRefund = unitNet * ri.quantity;
      refundAmount += lineRefund;

      const product = await salesRepository.findProduct(tx, companyId, item.productId);
      if (product) cogsReversal += Number(product.costPrice) * ri.quantity;

      await salesRepository.adjustProductStock(tx, companyId, item.productId, ri.quantity);
      await salesRepository.incrementItemReturnedQuantity(tx, companyId, item.id, ri.quantity);
      await salesRepository.insertReturnItem(tx, {
        companyId, saleReturnId: ret.id, saleItemId: item.id, productId: item.productId,
        quantity: ri.quantity, unitPrice: unitNet.toString(), subtotal: lineRefund.toString(), isExchange: false,
      });
    }

    let exchangeAmount = 0;
    let exchangeCogs = 0;

    for (const ei of input.exchangeItems ?? []) {
      if (!ei.quantity || ei.quantity <= 0) throw new SaleValidationError("Exchange quantity must be greater than zero");
      const product = await salesRepository.findProduct(tx, companyId, ei.productId);
      if (!product) throw new SaleValidationError(`Product ${ei.productId} not found`);
      if (product.stock < ei.quantity) throw new SaleValidationError(`Insufficient stock for ${product.name}`);

      const lineTotal = ei.unitPrice * ei.quantity;
      exchangeAmount += lineTotal;
      exchangeCogs += Number(product.costPrice) * ei.quantity;

      await salesRepository.adjustProductStock(tx, companyId, ei.productId, -ei.quantity);
      await salesRepository.insertReturnItem(tx, {
        companyId, saleReturnId: ret.id, saleItemId: null, productId: ei.productId,
        quantity: ei.quantity, unitPrice: ei.unitPrice.toString(), subtotal: lineTotal.toString(), isExchange: true,
      });
    }

    const netAmount = refundAmount - exchangeAmount;

    if (sale.customerId) {
      // netAmount > 0 reduces what the customer owes us (or grows their credit);
      // netAmount < 0 (exchanged-in items cost more) grows what they owe us.
      await settleOutstandingBalance(tx, companyId, sale.customerId, netAmount);
    } else {
      if (netAmount < -0.005) {
        throw new SaleValidationError("A customer must be selected on this sale to record the extra amount owed for an exchange");
      }
      if (refundMethod === "store_credit") {
        throw new SaleValidationError("Store-credit refunds require a customer");
      }
    }

    await postSaleReturnEntry(tx, {
      companyId,
      returnId: ret.id,
      date: new Date().toISOString().split("T")[0],
      refundAmount,
      exchangeAmount,
      cogsReversal,
      exchangeCogs,
      refundMethod,
    });

    await salesRepository.updateReturnTotals(tx, companyId, ret.id, refundAmount, exchangeAmount, netAmount);

    return { ...ret, refundAmount, exchangeAmount, netAmount };
  });
}

export async function getSaleReturns(companyId: string, saleId: string) {
  const returns = await salesRepository.getReturnsForSale(db, companyId, saleId);
  return Promise.all(returns.map(async (r) => ({
    ...r,
    items: await salesRepository.getReturnItems(db, companyId, r.id),
  })));
}

export { SaleValidationError };

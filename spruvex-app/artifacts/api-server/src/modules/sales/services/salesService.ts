import { db, type Sale } from "@workspace/db";
import { salesRepository, type SaleListFilters } from "../repositories/salesRepository";
import { recordPurchaseOnAccount, settleOutstandingBalance } from "../../customers/services/customerService";
import { postSaleEntry, postSaleReturnEntry, postSalePaymentEntry } from "../../accounting";
import { parseRequiredNumber, parseOptionalNumber, ValidationError } from "../../../lib/validation";
import { applyStockDelta } from "../../../lib/stockDelta";

export interface SaleItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  selectedAddons?: Array<{ groupName: string; optionName: string; priceDelta: number }>;
  itemNotes?: string;
  serialNumber?: string;
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
  orderType?: string;
  tableId?: string;
  status?: "draft" | "completed";
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
export async function createSale(companyId: string, input: CreateSaleInput, createdByUserId?: string, branchId?: string) {
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
    const resolvedItems: Array<{
      productId: string; productName: string; quantity: number; unitPrice: number; discount: number;
      subtotal: number; costPrice: number; warehouseId: string | null;
      selectedAddons?: SaleItemInput["selectedAddons"]; itemNotes?: string; serialNumber?: string;
    }> = [];

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
      // Drafts reserve nothing: stock is only checked and deducted when the draft is
      // approved/paid. Approving a stale draft re-validates every line anyway.
      if (input.status !== "draft" && product.stock < quantity) throw new SaleValidationError(`Insufficient stock for ${product.name}`);
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
        warehouseId: product.warehouseId,
        selectedAddons: item.selectedAddons,
        itemNotes: item.itemNotes,
        serialNumber: item.serialNumber,
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
    const isDraft = input.status === "draft";
    const saleStatus = isDraft ? "draft" : (shortfall > 0.005 ? "partially_paid" : "completed");

    const sale = await salesRepository.insertSale(tx, {
      companyId,
      customerId: input.customerId,
      cashSessionId: isDraft ? null : input.cashSessionId,
      subtotal: subtotal.toString(),
      discount: (input.discount ?? 0).toString(),
      total: total.toString(),
      paymentFee: paymentFee.toString(),
      amountPaid: isDraft ? "0" : paidTotal.toString(),
      change: isDraft ? "0" : change.toString(),
      paymentMethod: isDraft ? "draft" : (isSplit ? "mixed" : input.paymentMethod),
      paymentMethodId: isDraft ? null : input.paymentMethodId,
      status: saleStatus,
      notes: input.notes,
      createdByUserId,
      branchId,
      orderType: input.orderType,
      tableId: input.tableId,
    });

    if (isDraft) {
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
          selectedAddons: item.selectedAddons,
          itemNotes: item.itemNotes,
          serialNumber: item.serialNumber,
        });
      }
      return { ...sale, customerName: null, outstandingAdded: 0 };
    }

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
        selectedAddons: item.selectedAddons,
        itemNotes: item.itemNotes,
        serialNumber: item.serialNumber,
      });
      // Deducts from both the per-warehouse stock table and the legacy
      // products.stock mirror in one place (see lib/stockDelta.ts) — before
      // this, sales only touched products.stock and the inventory pages'
      // per-warehouse numbers drifted stale.
      const booked = await applyStockDelta(tx, {
        companyId, productId: item.productId, delta: -item.quantity,
        warehouseId: item.warehouseId, movementType: "sale",
        referenceType: "sale", referenceId: sale.id,
      });
      if (booked === null) throw new SaleValidationError(`Insufficient stock for ${item.productName}`);
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

export interface UpdateDraftSaleInput {
  customerId?: string;
  items?: SaleItemInput[];
  discount?: number;
  notes?: string;
}

export interface ApproveSaleInput {
  payments?: SalePaymentInput[];
  paymentMethod?: string;
  paymentMethodId?: string;
  amountPaid?: number;
  cashSessionId?: string;
  notes?: string;
}

// Edit a saved draft: replace the header fields given and, when items are supplied,
// swap the whole line set and recompute the totals. Drafts hold no stock, so no
// stock movements, journal entries, or balances are touched here — those all happen
// (once) when the draft is approved.
export async function updateDraftSale(companyId: string, saleId: string, input: UpdateDraftSaleInput) {
  return db.transaction(async (tx) => {
    const sale = await salesRepository.findRawById(tx, companyId, saleId);
    if (!sale) throw new SaleValidationError("Sale not found");
    if (sale.status !== "draft") throw new SaleValidationError("Only draft sales can be edited");

    let subtotal = Number(sale.subtotal);
    if (input.items && input.items.length > 0) {
      subtotal = 0;
      const resolvedItems: Array<{
        productId: string; productName: string; quantity: number; unitPrice: number; discount: number;
        subtotal: number; selectedAddons?: SaleItemInput["selectedAddons"]; itemNotes?: string; serialNumber?: string;
      }> = [];
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
        const itemSubtotal = unitPrice * quantity - discount;
        subtotal += itemSubtotal;
        resolvedItems.push({
          productId: item.productId,
          productName: product.name,
          quantity,
          unitPrice,
          discount,
          subtotal: itemSubtotal,
          selectedAddons: item.selectedAddons,
          itemNotes: item.itemNotes,
          serialNumber: item.serialNumber,
        });
      }
      await salesRepository.deleteItems(tx, companyId, saleId);
      for (const item of resolvedItems) {
        await salesRepository.insertItem(tx, {
          companyId,
          saleId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          discount: item.discount.toString(),
          subtotal: item.subtotal.toString(),
          selectedAddons: item.selectedAddons,
          itemNotes: item.itemNotes,
          serialNumber: item.serialNumber,
        });
      }
    }

    const discount = input.discount ?? Number(sale.discount);
    const total = Math.max(subtotal - discount, 0);

    await salesRepository.updateHeader(tx, companyId, saleId, {
      subtotal: subtotal.toString(),
      discount: discount.toString(),
      total: total.toString(),
      ...(input.customerId !== undefined ? { customerId: input.customerId || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    });

    const [updated, updatedItems] = await Promise.all([
      salesRepository.findById(tx, companyId, saleId),
      salesRepository.getItems(tx, companyId, saleId),
    ]);
    return { ...updated, items: updatedItems, payments: [] };
  });
}

// Turn a draft into a live sale in one transaction: re-validate and book stock,
// collect the payment (or record the on-account balance), bump the cash session,
// and post the journal entry. Everything rolls back together on any failure.
export async function approveSale(companyId: string, saleId: string, input: ApproveSaleInput) {
  return db.transaction(async (tx) => {
    const sale = await salesRepository.findRawById(tx, companyId, saleId);
    if (!sale) throw new SaleValidationError("Sale not found");
    if (sale.status !== "draft") throw new SaleValidationError("Only draft sales can be approved");

    const items = await salesRepository.getItems(tx, companyId, saleId);
    if (items.length === 0) throw new SaleValidationError("Draft has no items to approve");

    const isSplit = Array.isArray(input.payments) && input.payments.length > 0;
    if (isSplit) {
      for (const p of input.payments!) {
        if (typeof p.amount !== "number" || p.amount < 0 || !p.methodName) {
          throw new SaleValidationError("Each payment requires a methodName and a non-negative amount");
        }
      }
    }

    const subtotal = items.reduce((sum, it) => sum + Number(it.subtotal), 0);
    const discount = Number(sale.discount);
    const goodsTotal = subtotal - discount;

    let totalFee = 0;
    if (isSplit) {
      for (const p of input.payments!) {
        if (!p.paymentMethodId) continue;
        const method = await salesRepository.findPaymentMethod(tx, companyId, p.paymentMethodId);
        if (method) totalFee += p.amount * (parseFloat(method.percentFee) / 100) + parseFloat(method.fixedFee);
      }
    } else if (input.paymentMethodId) {
      const method = await salesRepository.findPaymentMethod(tx, companyId, input.paymentMethodId);
      if (method) totalFee = goodsTotal * (parseFloat(method.percentFee) / 100) + parseFloat(method.fixedFee);
    }
    const total = goodsTotal + totalFee;

    let paidTotal = input.amountPaid ?? total;
    if (isSplit) paidTotal = input.payments!.reduce((sum, p) => sum + p.amount, 0);
    const shortfall = Math.max(total - paidTotal, 0);
    if (shortfall > 0.005 && !sale.customerId) {
      throw new SaleValidationError("A customer must be selected to record the unpaid balance of this sale");
    }
    const change = Math.max(paidTotal - total, 0);

    let cogsTotal = 0;
    for (const item of items) {
      const product = await salesRepository.findProduct(tx, companyId, item.productId);
      if (!product) throw new SaleValidationError(`Product ${item.productId} not found`);
      const available = item.quantity - (item.returnedQuantity ?? 0);
      if (product.stock < available) throw new SaleValidationError(`Insufficient stock for ${product.name}`);
      const booked = await applyStockDelta(tx, {
        companyId, productId: item.productId, delta: -available,
        warehouseId: product.warehouseId, movementType: "sale",
        referenceType: "sale", referenceId: saleId,
      });
      if (booked === null) throw new SaleValidationError(`Insufficient stock for ${product.name}`);
      cogsTotal += Number(product.costPrice) * available;
    }

    await salesRepository.updateHeader(tx, companyId, saleId, {
      subtotal: subtotal.toString(),
      discount: discount.toString(),
      total: total.toString(),
      paymentFee: totalFee.toString(),
      amountPaid: paidTotal.toString(),
      change: change.toString(),
      paymentMethod: isSplit ? "mixed" : (input.paymentMethod ?? "cash"),
      paymentMethodId: input.paymentMethodId ?? null,
      status: shortfall > 0.005 ? "partially_paid" : "completed",
      cashSessionId: input.cashSessionId ?? sale.cashSessionId,
      notes: input.notes ?? sale.notes,
    });

    if (isSplit) {
      for (const p of input.payments!) {
        await salesRepository.insertPayment(tx, {
          companyId,
          saleId,
          paymentMethodId: p.paymentMethodId ?? null,
          methodName: p.methodName,
          amount: p.amount.toString(),
        });
      }
    } else if (paidTotal > 0.005) {
      await salesRepository.insertPayment(tx, {
        companyId,
        saleId,
        paymentMethodId: input.paymentMethodId ?? null,
        methodName: input.paymentMethod ?? "cash",
        amount: paidTotal.toString(),
      });
    }

    if (sale.customerId) {
      await recordPurchaseOnAccount(tx, companyId, sale.customerId, shortfall);
    }

    const sessionId = input.cashSessionId ?? sale.cashSessionId;
    if (sessionId) {
      await salesRepository.incrementCashSessionTotal(tx, companyId, sessionId, total);
    }

    await postSaleEntry(tx, {
      companyId,
      saleId,
      date: new Date().toISOString().split("T")[0],
      total,
      shortfall,
      cogsTotal,
      paymentFee: totalFee,
    });

    const [updated, updatedItems, updatedPayments] = await Promise.all([
      salesRepository.findById(tx, companyId, saleId),
      salesRepository.getItems(tx, companyId, saleId),
      salesRepository.getPayments(tx, companyId, saleId),
    ]);
    return { ...updated, items: updatedItems, payments: updatedPayments };
  });
}

// Collect a late/partial payment on a sale that still has an outstanding balance
// (from an on-account or under-paid checkout). Reduces the customer's receivable,
// posts the cash/AR journal entry, and re-derives the sale status.
export async function recordSalePayment(companyId: string, saleId: string, input: { payments: SalePaymentInput[] }) {
  if (!input.payments || input.payments.length === 0) {
    throw new SaleValidationError("At least one payment is required");
  }
  for (const p of input.payments) {
    if (typeof p.amount !== "number" || p.amount <= 0 || !p.methodName) {
      throw new SaleValidationError("Each payment requires a methodName and a positive amount");
    }
  }

  return db.transaction(async (tx) => {
    const sale = await salesRepository.findRawById(tx, companyId, saleId);
    if (!sale) throw new SaleValidationError("Sale not found");
    if (sale.status === "draft" || sale.status === "returned") {
      throw new SaleValidationError("This sale cannot accept payments in its current state");
    }
    if (!sale.customerId) {
      throw new SaleValidationError("Recording a payment requires a customer on the sale");
    }

    const total = Number(sale.total);
    const amountPaid = Number(sale.amountPaid);
    const outstanding = Math.max(total - amountPaid, 0);
    if (outstanding <= 0.005) throw new SaleValidationError("This sale has no outstanding balance");
    const paying = input.payments.reduce((sum, p) => sum + p.amount, 0);
    if (paying > outstanding + 0.005) {
      throw new SaleValidationError(`Payment exceeds the outstanding balance of ${outstanding.toFixed(2)}`);
    }

    let totalFee = 0;
    for (const p of input.payments) {
      if (!p.paymentMethodId) continue;
      const method = await salesRepository.findPaymentMethod(tx, companyId, p.paymentMethodId);
      if (method) totalFee += p.amount * (parseFloat(method.percentFee) / 100) + parseFloat(method.fixedFee);
    }

    const newTotal = total + totalFee;
    const newPaid = amountPaid + paying;
    const newOutstanding = Math.max(newTotal - newPaid, 0);
    const change = Math.max(newPaid - newTotal, 0);

    for (const p of input.payments) {
      await salesRepository.insertPayment(tx, {
        companyId,
        saleId,
        paymentMethodId: p.paymentMethodId ?? null,
        methodName: p.methodName,
        amount: p.amount.toString(),
      });
    }

    await salesRepository.updateHeader(tx, companyId, saleId, {
      total: newTotal.toString(),
      paymentFee: (Number(sale.paymentFee) + totalFee).toString(),
      amountPaid: newPaid.toString(),
      change: change.toString(),
      status: newOutstanding <= 0.005 ? "completed" : "partially_paid",
      paymentMethod: input.payments.length > 1 ? "mixed" : input.payments[0].methodName,
    });

    await settleOutstandingBalance(tx, companyId, sale.customerId, paying);

    await postSalePaymentEntry(tx, {
      companyId,
      saleId,
      date: new Date().toISOString().split("T")[0],
      amount: paying,
    });

    return salesRepository.findById(tx, companyId, saleId);
  });
}

export async function deleteDraftSale(companyId: string, saleId: string): Promise<void> {
  return db.transaction(async (tx) => {
    const sale = await salesRepository.findRawById(tx, companyId, saleId);
    if (!sale) throw new SaleValidationError("Sale not found");
    if (sale.status !== "draft") throw new SaleValidationError("Only draft sales can be deleted");
    await salesRepository.deleteItems(tx, companyId, saleId);
    await salesRepository.deleteSale(tx, companyId, saleId);
  });
}

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

      await applyStockDelta(tx, {
        companyId, productId: item.productId, delta: ri.quantity,
        warehouseId: product?.warehouseId, movementType: "sale_return",
        referenceType: "sale_return", referenceId: ret.id,
      });
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

      await applyStockDelta(tx, {
        companyId, productId: ei.productId, delta: -ei.quantity,
        warehouseId: product.warehouseId, movementType: "sale",
        referenceType: "sale_return", referenceId: ret.id,
      });
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

export async function listSaleReturns(companyId: string, filters: SaleListFilters) {
  return salesRepository.listReturns(db, companyId, filters);
}

export async function getSaleReturns(companyId: string, saleId: string) {
  const returns = await salesRepository.getReturnsForSale(db, companyId, saleId);
  return Promise.all(returns.map(async (r) => ({
    ...r,
    items: await salesRepository.getReturnItems(db, companyId, r.id),
  })));
}

export { SaleValidationError };

import type { JournalEntry } from "@workspace/db";
import { postEntry } from "./ledgerService";
import { getAccountsByCode } from "./chartOfAccountsService";
import type { DbClient, JournalLineInput } from "../types";

const EXPENSE_CATEGORY_TO_CODE: Record<string, string> = {
  rent: "5100", salary: "5110", utilities: "5120", supplies: "5130", maintenance: "5140", other: "5190",
};

function signedLine(accountId: string, amount: number): JournalLineInput | null {
  if (Math.abs(amount) < 0.005) return null;
  return amount >= 0 ? { accountId, credit: amount } : { accountId, debit: -amount };
}

/**
 * Dr Cash (cash actually retained = total - shortfall) + Dr Accounts Receivable (shortfall)
 * Cr Sales Revenue (goods total) + Cr Payment Fee Income (payment-method surcharge, if any)
 * Dr Cost of Goods Sold + Cr Inventory (cost of items sold)
 */
export async function postSaleEntry(db: DbClient, params: {
  companyId: string; saleId: string; date: string;
  total: number; shortfall: number; cogsTotal: number; paymentFee?: number;
}): Promise<JournalEntry> {
  const accounts = await getAccountsByCode(db, params.companyId);
  const cash = accounts.get("1000")!;
  const ar = accounts.get("1100")!;
  const revenue = accounts.get("4000")!;
  const feeIncome = accounts.get("4100")!;
  const inventory = accounts.get("1200")!;
  const cogs = accounts.get("5000")!;

  const paymentFee = params.paymentFee ?? 0;
  const goodsTotal = params.total - paymentFee;
  const cashRetained = params.total - params.shortfall;
  const lines: JournalLineInput[] = [];
  if (cashRetained > 0.005) lines.push({ accountId: cash.id, debit: cashRetained });
  if (params.shortfall > 0.005) lines.push({ accountId: ar.id, debit: params.shortfall });
  lines.push({ accountId: revenue.id, credit: goodsTotal });
  if (paymentFee > 0.005) lines.push({ accountId: feeIncome.id, credit: paymentFee });
  if (params.cogsTotal > 0.005) {
    lines.push({ accountId: cogs.id, debit: params.cogsTotal });
    lines.push({ accountId: inventory.id, credit: params.cogsTotal });
  }

  return postEntry(db, {
    companyId: params.companyId,
    date: params.date,
    sourceType: "sale",
    sourceId: params.saleId,
    memo: `Sale #${params.saleId}`,
    lines,
  });
}

/**
 * Reverses the original sale's revenue/COGS for the returned units, and — if items
 * were exchanged in the same transaction — books a normal sale entry for them. The
 * two are netted on the cash/AR side so only the actual money/credit movement posts:
 * Dr Sales Revenue (refundAmount) ; Cr Sales Revenue (exchangeAmount)
 * Dr/Cr [Cash or AR, by refundMethod] (refundAmount - exchangeAmount, signed)
 * Dr Inventory + Cr COGS (cost of returned units) ; Dr COGS + Cr Inventory (cost of exchanged units)
 */
export async function postSaleReturnEntry(db: DbClient, params: {
  companyId: string; returnId: string; date: string;
  refundAmount: number; exchangeAmount: number; cogsReversal: number; exchangeCogs: number;
  refundMethod: "cash" | "store_credit";
}): Promise<JournalEntry> {
  const accounts = await getAccountsByCode(db, params.companyId);
  const cash = accounts.get("1000")!;
  const ar = accounts.get("1100")!;
  const revenue = accounts.get("4000")!;
  const inventory = accounts.get("1200")!;
  const cogs = accounts.get("5000")!;
  const cashOrAR = params.refundMethod === "store_credit" ? ar : cash;

  const lines: JournalLineInput[] = [];
  if (params.refundAmount > 0.005) lines.push({ accountId: revenue.id, debit: params.refundAmount });
  if (params.exchangeAmount > 0.005) lines.push({ accountId: revenue.id, credit: params.exchangeAmount });

  const netCashOut = params.refundAmount - params.exchangeAmount;
  if (netCashOut > 0.005) lines.push({ accountId: cashOrAR.id, credit: netCashOut });
  else if (netCashOut < -0.005) lines.push({ accountId: cashOrAR.id, debit: -netCashOut });

  if (params.cogsReversal > 0.005) {
    lines.push({ accountId: inventory.id, debit: params.cogsReversal });
    lines.push({ accountId: cogs.id, credit: params.cogsReversal });
  }
  if (params.exchangeCogs > 0.005) {
    lines.push({ accountId: cogs.id, debit: params.exchangeCogs });
    lines.push({ accountId: inventory.id, credit: params.exchangeCogs });
  }

  return postEntry(db, {
    companyId: params.companyId,
    date: params.date,
    sourceType: "sale_return",
    sourceId: params.returnId,
    memo: `Sale return #${params.returnId}`,
    lines,
  });
}

/** Dr Inventory (totalCost) ; Cr Cash (amountPaid) + Cr Accounts Payable (remainder owed). */
export async function postPurchaseEntry(db: DbClient, params: {
  companyId: string; purchaseId: string; date: string;
  totalCost: number; amountPaid: number;
}): Promise<JournalEntry> {
  const accounts = await getAccountsByCode(db, params.companyId);
  const inventory = accounts.get("1200")!;
  const cash = accounts.get("1000")!;
  const ap = accounts.get("2000")!;

  const remaining = params.totalCost - params.amountPaid;
  const lines: JournalLineInput[] = [{ accountId: inventory.id, debit: params.totalCost }];
  if (params.amountPaid > 0.005) lines.push({ accountId: cash.id, credit: params.amountPaid });
  const apLine = signedLine(ap.id, remaining);
  if (apLine) lines.push(apLine);

  return postEntry(db, {
    companyId: params.companyId,
    date: params.date,
    sourceType: "purchase",
    sourceId: params.purchaseId,
    memo: `Purchase #${params.purchaseId}`,
    lines,
  });
}

/**
 * Reverses the cost of returned units: Cr Inventory (amount) ; Dr Cash (cash refunded
 * by the supplier) or Dr Accounts Payable (amount credited against what's still owed).
 */
export async function postPurchaseReturnEntry(db: DbClient, params: {
  companyId: string; returnId: string; date: string;
  amount: number; refundMethod: "cash" | "credit_note";
}): Promise<JournalEntry> {
  const accounts = await getAccountsByCode(db, params.companyId);
  const inventory = accounts.get("1200")!;
  const cash = accounts.get("1000")!;
  const ap = accounts.get("2000")!;
  const debitAccount = params.refundMethod === "cash" ? cash : ap;

  return postEntry(db, {
    companyId: params.companyId,
    date: params.date,
    sourceType: "purchase_return",
    sourceId: params.returnId,
    memo: `Purchase return #${params.returnId}`,
    lines: [
      { accountId: debitAccount.id, debit: params.amount },
      { accountId: inventory.id, credit: params.amount },
    ],
  });
}

/** Dr [category's expense account] ; Cr Cash. */
export async function postExpenseEntry(db: DbClient, params: {
  companyId: string; expenseId: string; date: string;
  category: string; amount: number;
}): Promise<JournalEntry> {
  const accounts = await getAccountsByCode(db, params.companyId);
  const expenseCode = EXPENSE_CATEGORY_TO_CODE[params.category] ?? EXPENSE_CATEGORY_TO_CODE.other;
  const expenseAccount = accounts.get(expenseCode)!;
  const cash = accounts.get("1000")!;

  return postEntry(db, {
    companyId: params.companyId,
    date: params.date,
    sourceType: "expense",
    sourceId: params.expenseId,
    memo: `Expense #${params.expenseId}`,
    lines: [
      { accountId: expenseAccount.id, debit: params.amount },
      { accountId: cash.id, credit: params.amount },
    ],
  });
}

// Which control account a voucher's "other side" hits, by who it's with — not by
// receipt/payment. This is what makes all 5 combinations (customer receipt/payment,
// supplier receipt/payment, employee receipt/payment) post correctly: the account
// chosen here is the same regardless of direction, only the debit/credit side flips.
const VOUCHER_PARTY_ACCOUNT_CODE: Record<string, string> = {
  customer: "1100", // Accounts Receivable
  supplier: "2000", // Accounts Payable
  employee: "1300", // Employee Advances
  other: "1100", // no dedicated control account for free-text parties — AR is the safe default
};

/**
 * Receipt (قبض): Dr Cash ; Cr [party's control account].
 * Payment (صرف): Dr [party's control account] ; Cr Cash.
 *
 * The party account is chosen by `partyType`, not by receipt/payment — that's the
 * fix: a customer payment (refund) posts against AR (not AP), and a supplier receipt
 * posts against AP (not AR), matching the account the party's balance actually lives in.
 */
export async function postVoucherEntry(db: DbClient, params: {
  companyId: string; voucherId: string; date: string;
  type: "receipt" | "payment"; amount: number; partyType?: string;
}): Promise<JournalEntry> {
  const accounts = await getAccountsByCode(db, params.companyId);
  const cash = accounts.get("1000")!;
  const partyCode = VOUCHER_PARTY_ACCOUNT_CODE[params.partyType ?? "other"] ?? VOUCHER_PARTY_ACCOUNT_CODE.other;
  const partyAccount = accounts.get(partyCode)!;

  const lines: JournalLineInput[] = params.type === "receipt"
    ? [{ accountId: cash.id, debit: params.amount }, { accountId: partyAccount.id, credit: params.amount }]
    : [{ accountId: partyAccount.id, debit: params.amount }, { accountId: cash.id, credit: params.amount }];

  return postEntry(db, {
    companyId: params.companyId,
    date: params.date,
    sourceType: params.type === "receipt" ? "voucher_receipt" : "voucher_payment",
    sourceId: params.voucherId,
    memo: `Voucher #${params.voucherId}`,
    lines,
  });
}

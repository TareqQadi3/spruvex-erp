import type { db } from "@workspace/db";

// Repository/service functions accept either the plain `db` handle or a `tx` handle
// from `db.transaction(...)` — both expose the same query-builder surface, so callers
// can post ledger entries either standalone or atomically alongside the business
// record that caused them (the latter is what sales/purchases/expenses/vouchers do).
export type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type NormalBalance = "debit" | "credit";
export type JournalSourceType = "sale" | "purchase" | "expense" | "voucher_receipt" | "voucher_payment" | "manual" | "sale_return" | "purchase_return";

export interface JournalLineInput {
  accountId: string;
  debit?: number;
  credit?: number;
  memo?: string;
}

export interface PostEntryInput {
  companyId: string;
  date: string;
  memo?: string;
  sourceType: JournalSourceType;
  sourceId?: string;
  isManual?: boolean;
  createdBy?: string;
  lines: JournalLineInput[];
}

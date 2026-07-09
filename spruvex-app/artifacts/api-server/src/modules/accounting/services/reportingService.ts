import { journalRepository, type TrialBalanceRow } from "../repositories/journalRepository";
import type { DbClient } from "../types";

export interface TrialBalanceLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountNameAr: string | null;
  accountType: string;
  debit: number;
  credit: number;
}

export interface TrialBalanceResult {
  asOf: string | null;
  lines: TrialBalanceLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

// A classic trial balance: raw debit/credit totals per account. Because every
// journal entry is balanced at write-time (see ledgerService.postEntry), the grand
// totals below are mathematically guaranteed to match — this report is also the
// simplest possible proof that the ledger is internally consistent.
export async function getTrialBalance(db: DbClient, companyId: string, asOf?: string): Promise<TrialBalanceResult> {
  const rows: TrialBalanceRow[] = await journalRepository.getTrialBalance(db, companyId, asOf);

  const lines: TrialBalanceLine[] = rows
    .map(r => ({
      accountId: r.accountId,
      accountCode: r.accountCode,
      accountName: r.accountName,
      accountNameAr: r.accountNameAr,
      accountType: r.accountType,
      debit: Number(r.totalDebit),
      credit: Number(r.totalCredit),
    }))
    .filter(l => l.debit > 0.005 || l.credit > 0.005);

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  return {
    asOf: asOf ?? null,
    lines,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
}

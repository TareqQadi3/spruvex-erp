import type { JournalEntry } from "@workspace/db";
import { journalRepository } from "../repositories/journalRepository";
import type { DbClient, PostEntryInput } from "../types";

function generateEntryNumber(date: string): string {
  const stamp = date.replace(/-/g, "");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `JE-${stamp}-${suffix}`;
}

const BALANCE_TOLERANCE = 0.01;

// The single choke point every journal entry passes through: validates that debits
// equal credits before anything is written, so an unbalanced entry is impossible —
// not just discouraged.
export async function postEntry(db: DbClient, input: PostEntryInput): Promise<JournalEntry> {
  const lines = input.lines.filter(l => (l.debit ?? 0) !== 0 || (l.credit ?? 0) !== 0);
  if (lines.length === 0) {
    throw new Error("Journal entry must have at least one non-zero line");
  }

  const totalDebit = lines.reduce((sum, l) => sum + (l.debit ?? 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > BALANCE_TOLERANCE) {
    throw new Error(`Unbalanced journal entry: debit ${totalDebit.toFixed(2)} != credit ${totalCredit.toFixed(2)}`);
  }

  const entry = await journalRepository.insertEntry(db, {
    companyId: input.companyId,
    entryNumber: generateEntryNumber(input.date),
    date: input.date,
    memo: input.memo ?? null,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    isManual: input.isManual ?? false,
    createdBy: input.createdBy ?? null,
  });

  await journalRepository.insertLines(db, lines.map(l => ({
    companyId: input.companyId,
    journalEntryId: entry.id,
    accountId: l.accountId,
    debit: (l.debit ?? 0).toString(),
    credit: (l.credit ?? 0).toString(),
    memo: l.memo ?? null,
  })));

  return entry;
}

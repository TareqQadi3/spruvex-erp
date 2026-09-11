import type { CashSession } from "@workspace/db";
import { cashSessionRepository } from "../repositories/cashSessionRepository";
import { salesRepository } from "../../sales/repositories/salesRepository";
import type { DbClient } from "../../accounting/types";

export interface CashSessionWithSummary extends Omit<CashSession, "openingBalance" | "totalSales" | "expectedBalance"> {
  openingBalance: number;
  totalSales: number;
  expectedBalance: number;
  discrepancy: number | null;
}

function sessionWithSummary(session: CashSession): CashSessionWithSummary {
  const openingBalance = parseFloat(session.openingBalance) || 0;
  const expectedBalance = parseFloat(session.expectedBalance ?? "0") || 0;
  const closingBalance = session.closingBalance != null ? parseFloat(session.closingBalance) : null;
  const totalSales = parseFloat(session.totalSales) || 0;
  // Matches the legacy route's actual (slightly inconsistent) shape exactly:
  // closingBalance stays the raw string from `session` in the response —
  // only used here, parsed, for the discrepancy calculation below.
  return {
    ...session,
    openingBalance,
    totalSales,
    expectedBalance: session.status === "closed" ? expectedBalance : openingBalance + totalSales,
    discrepancy: closingBalance != null ? Math.round((closingBalance - expectedBalance) * 100) / 100 : null,
  };
}

export async function listCashSessions(db: DbClient, companyId: string): Promise<CashSessionWithSummary[]> {
  const sessions = await cashSessionRepository.list(db, companyId);
  return sessions.map(sessionWithSummary);
}

export async function getActiveCashSession(db: DbClient, companyId: string): Promise<CashSessionWithSummary | undefined> {
  const session = await cashSessionRepository.findOpen(db, companyId);
  return session ? sessionWithSummary(session) : undefined;
}

export async function getCashSessionDetail(db: DbClient, companyId: string, id: string) {
  const session = await cashSessionRepository.findById(db, companyId, id);
  if (!session) return undefined;
  const sales = await salesRepository.list(db, companyId, { cashSessionId: id });
  const paidTotal = sales.reduce((sum, s) => sum + (Number(s.amountPaid) || 0), 0);
  return { ...sessionWithSummary(session), sales, paidTotal };
}

export interface OpenCashSessionInput {
  openingBalance: number;
  notes?: string;
}

export class SessionAlreadyOpenError extends Error {}

export async function openCashSession(db: DbClient, companyId: string, input: OpenCashSessionInput): Promise<CashSession> {
  if (input.openingBalance === undefined) throw new Error("openingBalance is required");

  const existing = await cashSessionRepository.findOpen(db, companyId);
  if (existing) throw new SessionAlreadyOpenError("A cash session is already open");

  return cashSessionRepository.insert(db, {
    companyId, openingBalance: input.openingBalance.toString(), notes: input.notes, status: "open",
  });
}

export interface CloseCashSessionInput {
  closingBalance: number;
  notes?: string;
}

export async function closeCashSession(db: DbClient, companyId: string, id: string, input: CloseCashSessionInput): Promise<CashSessionWithSummary | undefined> {
  const session = await cashSessionRepository.findById(db, companyId, id);
  if (!session) return undefined;

  const totalSales = await cashSessionRepository.sumSalesTotal(db, companyId, id);
  const expectedBalance = parseFloat(session.openingBalance) + totalSales;

  const updated = await cashSessionRepository.close(db, companyId, id, {
    status: "closed",
    closedAt: new Date(),
    closingBalance: input.closingBalance.toString(),
    expectedBalance: expectedBalance.toString(),
    totalSales: totalSales.toString(),
    notes: input.notes ?? session.notes,
  });
  return sessionWithSummary(updated);
}

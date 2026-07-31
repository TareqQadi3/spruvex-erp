import { Router } from "express";
import { db, cashSessionsTable, salesTable } from "@workspace/db";
import { eq, and, sum } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";
import { salesRepository } from "../modules/sales/repositories/salesRepository";

const router = Router();

function sessionWithSummary(session: typeof cashSessionsTable.$inferSelect) {
  const openingBalance = parseFloat(session.openingBalance) || 0;
  const expectedBalance = parseFloat(session.expectedBalance ?? "0") || 0;
  const closingBalance = session.closingBalance != null ? parseFloat(session.closingBalance) : null;
  const totalSales = parseFloat(session.totalSales) || 0;
  return {
    ...session,
    openingBalance,
    totalSales,
    expectedBalance: session.status === "closed" ? expectedBalance : openingBalance + totalSales,
    discrepancy: closingBalance != null ? Math.round((closingBalance - expectedBalance) * 100) / 100 : null,
  };
}

router.get("/", async (req: AuthedRequest, res) => {
  const sessions = await db.select().from(cashSessionsTable)
    .where(eq(cashSessionsTable.companyId, req.user!.companyId))
    .orderBy(cashSessionsTable.openedAt);
  res.json(sessions.map(sessionWithSummary));
});

router.get("/active", async (req: AuthedRequest, res) => {
  const [session] = await db.select().from(cashSessionsTable)
    .where(and(eq(cashSessionsTable.status, "open"), eq(cashSessionsTable.companyId, req.user!.companyId)))
    .limit(1);
  if (!session) {
    res.status(404).json({ error: "No active session" });
    return;
  }
  res.json(sessionWithSummary(session));
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const orgId = req.user!.companyId;
  const [session] = await db.select().from(cashSessionsTable)
    .where(and(eq(cashSessionsTable.id, id), eq(cashSessionsTable.companyId, orgId)));
  if (!session) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const sales = await salesRepository.list(db, orgId, { cashSessionId: id });
  const paidTotal = sales.reduce((sum, s) => sum + (Number(s.amountPaid) || 0), 0);
  res.json({ ...sessionWithSummary(session), sales, paidTotal });
});

router.post("/", async (req: AuthedRequest, res) => {
  const orgId = req.user!.companyId;
  const { openingBalance, notes } = req.body;
  if (openingBalance === undefined) {
    res.status(400).json({ error: "openingBalance is required" });
    return;
  }

  const [existing] = await db.select().from(cashSessionsTable)
    .where(and(eq(cashSessionsTable.status, "open"), eq(cashSessionsTable.companyId, orgId)))
    .limit(1);
  if (existing) {
    res.status(400).json({ error: "A cash session is already open" });
    return;
  }

  const [session] = await db.insert(cashSessionsTable).values({
    companyId: orgId,
    openingBalance: openingBalance.toString(),
    notes,
    status: "open",
  }).returning();
  res.status(201).json(session);
});

router.post("/:id/close", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const orgId = req.user!.companyId;
  const { closingBalance, notes } = req.body;

  const [session] = await db.select().from(cashSessionsTable)
    .where(and(eq(cashSessionsTable.id, id), eq(cashSessionsTable.companyId, orgId)));
  if (!session) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const result = await db.select({ total: sum(salesTable.total) }).from(salesTable)
    .where(and(eq(salesTable.cashSessionId, id), eq(salesTable.companyId, orgId)));
  const totalSales = parseFloat(result[0]?.total ?? "0") || 0;
  const expectedBalance = parseFloat(session.openingBalance) + totalSales;

  const [updated] = await db.update(cashSessionsTable).set({
    status: "closed",
    closedAt: new Date(),
    closingBalance: closingBalance.toString(),
    expectedBalance: expectedBalance.toString(),
    totalSales: totalSales.toString(),
    notes: notes ?? session.notes,
  }).where(and(eq(cashSessionsTable.id, id), eq(cashSessionsTable.companyId, orgId))).returning();
  res.json(sessionWithSummary(updated));
});

export default router;

import { Router } from "express";
import { db, cashSessionsTable, salesTable } from "@workspace/db";
import { eq, and, sum } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";

const router = Router();

router.get("/", async (req: AuthedRequest, res) => {
  const sessions = await db.select().from(cashSessionsTable)
    .where(eq(cashSessionsTable.companyId, req.user!.companyId))
    .orderBy(cashSessionsTable.openedAt);
  res.json(sessions);
});

router.get("/active", async (req: AuthedRequest, res) => {
  const [session] = await db.select().from(cashSessionsTable)
    .where(and(eq(cashSessionsTable.status, "open"), eq(cashSessionsTable.companyId, req.user!.companyId)))
    .limit(1);
  if (!session) {
    res.status(404).json({ error: "No active session" });
    return;
  }
  res.json(session);
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
  res.json(updated);
});

export default router;

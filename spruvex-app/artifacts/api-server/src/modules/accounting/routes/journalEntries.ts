import { Router } from "express";
import { db, PERMISSIONS } from "@workspace/db";
import { requirePermission, type AuthedRequest } from "../../../lib/auth-middleware";
import { ensureSeeded } from "../services/chartOfAccountsService";
import { postEntry } from "../services/ledgerService";
import { journalRepository } from "../repositories/journalRepository";

const router = Router();

router.get("/", requirePermission(PERMISSIONS.VIEW_REPORTS), async (req: AuthedRequest, res) => {
  const orgId = req.user!.companyId;
  const { from, to, sourceType } = req.query;
  const entries = await journalRepository.listEntries(db, orgId, {
    from: from as string | undefined,
    to: to as string | undefined,
    sourceType: sourceType as string | undefined,
  });
  const lines = await journalRepository.getLinesForEntries(db, orgId, entries.map(e => e.id));
  const linesByEntry = new Map<string, typeof lines>();
  for (const line of lines) {
    if (!linesByEntry.has(line.journalEntryId)) linesByEntry.set(line.journalEntryId, []);
    linesByEntry.get(line.journalEntryId)!.push(line);
  }
  res.json(entries.map(e => ({ ...e, lines: linesByEntry.get(e.id) ?? [] })));
});

router.post("/", requirePermission(PERMISSIONS.MANAGE_ACCOUNTING), async (req: AuthedRequest, res) => {
  const orgId = req.user!.companyId;
  await ensureSeeded(db, orgId);
  const { date, memo, lines } = req.body;
  if (!date || !Array.isArray(lines) || lines.length === 0) {
    res.status(400).json({ error: "date and at least one line are required" });
    return;
  }
  for (const line of lines) {
    if (!line.accountId || (line.debit == null && line.credit == null)) {
      res.status(400).json({ error: "Each line requires an accountId and a debit or credit amount" });
      return;
    }
  }
  try {
    const entry = await postEntry(db, {
      companyId: orgId,
      date,
      memo,
      sourceType: "manual",
      isManual: true,
      createdBy: req.user!.id,
      lines: lines.map((l: { accountId: string; debit?: number; credit?: number; memo?: string }) => ({
        accountId: l.accountId,
        debit: l.debit ? Number(l.debit) : undefined,
        credit: l.credit ? Number(l.credit) : undefined,
        memo: l.memo,
      })),
    });
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to post journal entry" });
  }
});

export default router;

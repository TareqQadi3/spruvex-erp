import { Router } from "express";
import { db, PERMISSIONS } from "@workspace/db";
import { requirePermission, type AuthedRequest } from "../../../lib/auth-middleware";
import { ensureSeeded, createAccount, updateAccount, AccountValidationError } from "../services/chartOfAccountsService";

const router = Router();

router.get("/", requirePermission(PERMISSIONS.VIEW_REPORTS), async (req: AuthedRequest, res) => {
  const accounts = await ensureSeeded(db, req.user!.companyId);
  res.json(accounts);
});

router.post("/", requirePermission(PERMISSIONS.MANAGE_ACCOUNTING), async (req: AuthedRequest, res) => {
  try {
    const account = await createAccount(db, req.user!.companyId, req.body);
    res.status(201).json(account);
  } catch (err) {
    if (err instanceof AccountValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.put("/:id", requirePermission(PERMISSIONS.MANAGE_ACCOUNTING), async (req: AuthedRequest, res) => {
  try {
    const account = await updateAccount(db, req.user!.companyId, req.params.id as string, req.body);
    if (!account) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(account);
  } catch (err) {
    if (err instanceof AccountValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;

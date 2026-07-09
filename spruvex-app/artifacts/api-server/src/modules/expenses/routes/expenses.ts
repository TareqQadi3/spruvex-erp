import { Router } from "express";
import type { AuthedRequest } from "../../../lib/auth-middleware";
import * as expenseService from "../services/expenseService";

const router = Router();

router.get("/", async (req: AuthedRequest, res) => {
  const { from, to, category } = req.query;
  const expenses = await expenseService.listExpenses(req.user!.companyId, {
    from: from as string | undefined,
    to: to as string | undefined,
    category: category as string | undefined,
  });
  res.json(expenses);
});

router.post("/", async (req: AuthedRequest, res) => {
  try {
    const expense = await expenseService.createExpense(req.user!.companyId, req.body);
    res.status(201).json(expense);
  } catch (err) {
    if (err instanceof expenseService.ExpenseValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  await expenseService.deleteExpense(req.user!.companyId, req.params.id as string);
  res.status(204).send();
});

export default router;

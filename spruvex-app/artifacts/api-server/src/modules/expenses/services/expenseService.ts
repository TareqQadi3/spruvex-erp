import { db, type Expense } from "@workspace/db";
import { expenseRepository, type ExpenseListFilters } from "../repositories/expenseRepository";
import { postExpenseEntry } from "../../accounting";
import { parseRequiredNumber, ValidationError } from "../../../lib/validation";

export interface CreateExpenseInput {
  description: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
}

class ExpenseValidationError extends Error {}

export async function listExpenses(companyId: string, filters: ExpenseListFilters): Promise<Expense[]> {
  return expenseRepository.list(db, companyId, filters);
}

export async function createExpense(companyId: string, input: CreateExpenseInput): Promise<Expense> {
  if (!input.description || !input.amount || !input.category || !input.date) {
    throw new ExpenseValidationError("description, amount, category, date are required");
  }
  let amount: number;
  try {
    amount = parseRequiredNumber(input.amount, "amount");
  } catch (err) {
    if (err instanceof ValidationError) throw new ExpenseValidationError(err.message);
    throw err;
  }
  if (amount <= 0) throw new ExpenseValidationError("amount must be greater than zero");
  return db.transaction(async (tx) => {
    const expense = await expenseRepository.insert(tx, {
      companyId,
      description: input.description,
      amount: amount.toString(),
      category: input.category,
      date: input.date,
      notes: input.notes,
    });
    await postExpenseEntry(tx, {
      companyId,
      expenseId: expense.id,
      date: expense.date,
      category: expense.category,
      amount: Number(expense.amount),
    });
    return expense;
  });
}

export async function deleteExpense(companyId: string, id: string): Promise<void> {
  return expenseRepository.delete(db, companyId, id);
}

export { ExpenseValidationError };

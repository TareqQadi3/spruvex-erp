import type { Account } from "@workspace/db";
import { accountRepository } from "../repositories/accountRepository";
import type { DbClient, AccountType, NormalBalance } from "../types";

export class AccountValidationError extends Error {}

const VALID_TYPES: AccountType[] = ["asset", "liability", "equity", "revenue", "expense"];
// Standard double-entry convention: assets/expenses carry a debit balance, the rest credit.
const CREDIT_NORMAL_TYPES = new Set<AccountType>(["liability", "equity", "revenue"]);

function normalBalanceForType(type: AccountType): NormalBalance {
  return CREDIT_NORMAL_TYPES.has(type) ? "credit" : "debit";
}

interface DefaultAccountDef {
  code: string;
  name: string;
  nameAr: string;
  type: AccountType;
  subtype?: string;
  normalBalance: NormalBalance;
}

// The accounts the automatic posting rules in postingService.ts depend on. Seeded
// once per Company, marked isSystem so they can't be deleted from the UI.
// The 5100-5190 range mirrors the 6 hardcoded expense categories already used in
// the Accounting page (rent/salary/utilities/supplies/maintenance/other) so expense
// postings need no new category-to-account mapping UI. 1300 (Employee Advances) is
// the control account employee receipt/payment vouchers post against.
export const DEFAULT_ACCOUNTS: DefaultAccountDef[] = [
  { code: "1000", name: "Cash", nameAr: "النقدية", type: "asset", subtype: "cash_bank", normalBalance: "debit" },
  { code: "1100", name: "Accounts Receivable", nameAr: "العملاء (ذمم مدينة)", type: "asset", subtype: "accounts_receivable", normalBalance: "debit" },
  { code: "1200", name: "Inventory", nameAr: "المخزون", type: "asset", subtype: "inventory", normalBalance: "debit" },
  { code: "1300", name: "Employee Advances", nameAr: "سلف الموظفين", type: "asset", subtype: "employee_advances", normalBalance: "debit" },
  { code: "2000", name: "Accounts Payable", nameAr: "الموردون (ذمم دائنة)", type: "liability", subtype: "accounts_payable", normalBalance: "credit" },
  { code: "2100", name: "VAT Payable", nameAr: "ضريبة القيمة المضافة المستحقة", type: "liability", subtype: "tax_payable", normalBalance: "credit" },
  { code: "3000", name: "Owner's Equity", nameAr: "حقوق الملكية", type: "equity", normalBalance: "credit" },
  { code: "4000", name: "Sales Revenue", nameAr: "إيرادات المبيعات", type: "revenue", subtype: "operating_revenue", normalBalance: "credit" },
  { code: "4100", name: "Payment Fee Income", nameAr: "إيرادات رسوم الدفع", type: "revenue", subtype: "operating_revenue", normalBalance: "credit" },
  { code: "5000", name: "Cost of Goods Sold", nameAr: "تكلفة البضاعة المباعة", type: "expense", subtype: "cogs", normalBalance: "debit" },
  { code: "5100", name: "Rent Expense", nameAr: "مصروف الإيجار", type: "expense", subtype: "operating_expense", normalBalance: "debit" },
  { code: "5110", name: "Salary Expense", nameAr: "مصروف الرواتب", type: "expense", subtype: "operating_expense", normalBalance: "debit" },
  { code: "5120", name: "Utilities Expense", nameAr: "مصروف المرافق", type: "expense", subtype: "operating_expense", normalBalance: "debit" },
  { code: "5130", name: "Supplies Expense", nameAr: "مصروف المستلزمات", type: "expense", subtype: "operating_expense", normalBalance: "debit" },
  { code: "5140", name: "Maintenance Expense", nameAr: "مصروف الصيانة", type: "expense", subtype: "operating_expense", normalBalance: "debit" },
  { code: "5190", name: "Other Expense", nameAr: "مصروفات أخرى", type: "expense", subtype: "operating_expense", normalBalance: "debit" },
];

// Idempotent — mirrors the getOrCreateSettings idiom already used in settings.ts.
// Safe to call on every request: inserts whatever default codes are missing, AND
// backfills nameAr on system accounts that were seeded before localization existed
// (otherwise an org that signed up before this feature shipped would be stuck with
// blank Arabic names forever — self-healing, not just a one-time migration).
export async function ensureSeeded(db: DbClient, companyId: string): Promise<Account[]> {
  const existing = await accountRepository.listByOrg(db, companyId);
  const existingByCode = new Map(existing.map(a => [a.code, a]));
  const missing = DEFAULT_ACCOUNTS.filter(d => !existingByCode.has(d.code));

  const inserted = missing.length > 0
    ? await accountRepository.insertMany(db, missing.map(d => ({
        companyId,
        code: d.code,
        name: d.name,
        nameAr: d.nameAr,
        type: d.type,
        subtype: d.subtype ?? null,
        parentId: null,
        normalBalance: d.normalBalance,
        isSystem: true,
        isActive: true,
      })))
    : [];

  const healed: Account[] = [];
  for (const def of DEFAULT_ACCOUNTS) {
    const row = existingByCode.get(def.code);
    if (row && row.isSystem && !row.nameAr) {
      healed.push((await accountRepository.update(db, companyId, row.id, { nameAr: def.nameAr }))!);
    }
  }

  if (inserted.length === 0 && healed.length === 0) return existing;
  const healedIds = new Set(healed.map(a => a.id));
  return [...existing.filter(a => !healedIds.has(a.id)), ...healed, ...inserted];
}

export async function getAccountsByCode(db: DbClient, companyId: string): Promise<Map<string, Account>> {
  const accounts = await ensureSeeded(db, companyId);
  return new Map(accounts.map(a => [a.code, a]));
}

export interface CreateAccountInput {
  code: string;
  name: string;
  nameAr?: string;
  type: string;
  subtype?: string;
  parentId?: string | null;
}

export async function createAccount(db: DbClient, companyId: string, input: CreateAccountInput): Promise<Account> {
  const code = input.code?.trim();
  const name = input.name?.trim();
  if (!code || !name) throw new AccountValidationError("code and name are required");
  if (!VALID_TYPES.includes(input.type as AccountType)) {
    throw new AccountValidationError(`type must be one of: ${VALID_TYPES.join(", ")}`);
  }

  const existing = await accountRepository.listByOrg(db, companyId);
  if (existing.some(a => a.code === code)) {
    throw new AccountValidationError(`An account with code "${code}" already exists`);
  }

  let parentId: string | null = null;
  if (input.parentId) {
    const parent = existing.find(a => a.id === input.parentId);
    if (!parent) throw new AccountValidationError("Parent account not found");
    parentId = parent.id;
  }

  return accountRepository.insertOne(db, {
    companyId,
    code,
    name,
    nameAr: input.nameAr?.trim() || null,
    type: input.type,
    subtype: input.subtype || null,
    parentId,
    normalBalance: normalBalanceForType(input.type as AccountType),
    isSystem: false,
    isActive: true,
  });
}

export interface UpdateAccountInput {
  name?: string;
  nameAr?: string | null;
  parentId?: string | null;
  isActive?: boolean;
}

export async function updateAccount(db: DbClient, companyId: string, id: string, input: UpdateAccountInput): Promise<Account | undefined> {
  const account = await accountRepository.findById(db, companyId, id);
  if (!account) return undefined;

  if (input.parentId !== undefined && input.parentId !== null) {
    if (input.parentId === id) throw new AccountValidationError("An account cannot be its own parent");
    const existing = await accountRepository.listByOrg(db, companyId);
    const parent = existing.find(a => a.id === input.parentId);
    if (!parent) throw new AccountValidationError("Parent account not found");
    // Walk up the prospective parent's ancestry to reject a cycle (A under B under A).
    let cursor: Account | undefined = parent;
    const seen = new Set<string>([id]);
    while (cursor) {
      if (seen.has(cursor.id)) throw new AccountValidationError("This would create a circular account hierarchy");
      seen.add(cursor.id);
      cursor = cursor.parentId ? existing.find(a => a.id === cursor!.parentId) : undefined;
    }
  }

  if (input.name !== undefined && !input.name.trim()) {
    throw new AccountValidationError("name cannot be empty");
  }

  return accountRepository.update(db, companyId, id, {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.nameAr !== undefined ? { nameAr: input.nameAr?.trim() || null } : {}),
    ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  });
}

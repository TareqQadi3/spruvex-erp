import { db, type Voucher } from "@workspace/db";
import { voucherRepository, type VoucherListFilters } from "../repositories/voucherRepository";
import { settleOutstandingBalance as settleCustomerBalance } from "../../customers/services/customerService";
import { settleOutstandingBalance as settleSupplierBalance } from "../../suppliers/services/supplierService";
import { postVoucherEntry } from "../../accounting";

export interface CreateVoucherInput {
  type: "receipt" | "payment";
  amount: number;
  party?: string;
  customerId?: string;
  supplierId?: string;
  employeeId?: string;
  description?: string;
  paymentMethod?: string;
  date: string;
}

// Reports group by this rather than inferring it from which optional FK is set.
// Employee vouchers settle no balance (no employee ledger exists) — recorded for
// reporting only, exactly as requested.
function resolvePartyType(input: CreateVoucherInput): "customer" | "supplier" | "employee" | "other" {
  if (input.customerId) return "customer";
  if (input.supplierId) return "supplier";
  if (input.employeeId) return "employee";
  return "other";
}

class VoucherValidationError extends Error {}

function generateVoucherNumber(type: string): string {
  const prefix = type === "receipt" ? "RCV" : "PAY";
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const suffix = Math.floor(1000 + Math.random() * 9000).toString();
  return `${prefix}-${stamp}-${suffix}`;
}

export async function listVouchers(companyId: string, filters: VoucherListFilters): Promise<Voucher[]> {
  return voucherRepository.list(db, companyId, filters);
}

// Receipt (قبض) settles a customer's receivable; payment (صرف) settles what we owe a
// supplier. Either way: the voucher row, the party's balance, and the journal entry
// commit together.
export async function createVoucher(companyId: string, input: CreateVoucherInput): Promise<Voucher> {
  if (!input.type || !input.amount || !input.date) {
    throw new VoucherValidationError("type, amount and date are required");
  }
  if (input.type !== "receipt" && input.type !== "payment") {
    throw new VoucherValidationError("type must be 'receipt' or 'payment'");
  }

  return db.transaction(async (tx) => {
    const voucher = await voucherRepository.insert(tx, {
      companyId,
      voucherNumber: generateVoucherNumber(input.type),
      type: input.type,
      amount: input.amount.toString(),
      party: input.party,
      partyType: resolvePartyType(input),
      customerId: input.customerId,
      supplierId: input.supplierId,
      employeeId: input.employeeId,
      description: input.description,
      paymentMethod: input.paymentMethod ?? "cash",
      date: input.date,
    });

    if (input.type === "receipt" && input.customerId) {
      await settleCustomerBalance(tx, companyId, input.customerId, input.amount);
    }
    if (input.type === "payment" && input.supplierId) {
      await settleSupplierBalance(tx, companyId, input.supplierId, input.amount);
    }

    await postVoucherEntry(tx, {
      companyId,
      voucherId: voucher.id,
      date: voucher.date,
      type: input.type,
      amount: input.amount,
      partyType: voucher.partyType,
    });

    return voucher;
  });
}

export async function deleteVoucher(companyId: string, id: string): Promise<void> {
  return voucherRepository.delete(db, companyId, id);
}

export { VoucherValidationError };

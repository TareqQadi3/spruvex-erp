import type { Supplier } from "@workspace/db";
import { supplierRepository, type SupplierUpdate } from "../repositories/supplierRepository";
import type { DbClient } from "../../accounting/types";

export interface CreateSupplierInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  outstandingBalance?: number;
}

export async function listSuppliers(db: DbClient, companyId: string, search?: string): Promise<Supplier[]> {
  return supplierRepository.list(db, companyId, search);
}

export async function getSupplier(db: DbClient, companyId: string, id: string): Promise<Supplier | undefined> {
  return supplierRepository.findById(db, companyId, id);
}

export async function createSupplier(db: DbClient, companyId: string, input: CreateSupplierInput): Promise<Supplier> {
  if (!input.name) throw new Error("name is required");
  return supplierRepository.insert(db, {
    companyId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    address: input.address,
    notes: input.notes,
    outstandingBalance: input.outstandingBalance?.toString() ?? "0",
  });
}

export async function updateSupplier(db: DbClient, companyId: string, id: string, input: Partial<CreateSupplierInput>): Promise<Supplier | undefined> {
  const changes: SupplierUpdate = {
    name: input.name,
    phone: input.phone,
    email: input.email,
    address: input.address,
    notes: input.notes,
  };
  if (input.outstandingBalance !== undefined) changes.outstandingBalance = input.outstandingBalance.toString();
  return supplierRepository.update(db, companyId, id, changes);
}

export async function deleteSupplier(db: DbClient, companyId: string, id: string): Promise<void> {
  return supplierRepository.delete(db, companyId, id);
}

// Called by purchasesService inside the purchase transaction: grows what we owe the
// supplier by whatever wasn't paid immediately.
export async function recordPurchaseDebt(db: DbClient, companyId: string, supplierId: string, remaining: number): Promise<void> {
  if (remaining !== 0) {
    await supplierRepository.incrementOutstandingBalance(db, companyId, supplierId, remaining);
  }
}

// Called by vouchersService when a payment (صرف) voucher is recorded against a supplier.
export async function settleOutstandingBalance(db: DbClient, companyId: string, supplierId: string, amount: number): Promise<void> {
  await supplierRepository.incrementOutstandingBalance(db, companyId, supplierId, -amount);
}

import type { Customer } from "@workspace/db";
import { customerRepository, type CustomerUpdate } from "../repositories/customerRepository";
import type { DbClient } from "../../accounting/types";

export interface CreateCustomerInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  outstandingBalance?: number;
}

export async function listCustomers(db: DbClient, companyId: string, search?: string): Promise<Customer[]> {
  return customerRepository.list(db, companyId, search);
}

export async function getCustomerWithHistory(db: DbClient, companyId: string, id: string) {
  const customer = await customerRepository.findById(db, companyId, id);
  if (!customer) return undefined;
  const [recentSales, recentRepairs] = await Promise.all([
    customerRepository.recentSales(db, companyId, id, 10),
    customerRepository.recentRepairs(db, companyId, id, 10),
  ]);
  return { ...customer, recentSales, recentRepairs };
}

export async function createCustomer(db: DbClient, companyId: string, input: CreateCustomerInput): Promise<Customer> {
  if (!input.name) throw new Error("name is required");
  return customerRepository.insert(db, {
    companyId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    address: input.address,
    outstandingBalance: input.outstandingBalance?.toString() ?? "0",
  });
}

export async function updateCustomer(db: DbClient, companyId: string, id: string, input: Partial<CreateCustomerInput>): Promise<Customer | undefined> {
  const changes: CustomerUpdate = {
    name: input.name,
    phone: input.phone,
    email: input.email,
    address: input.address,
  };
  if (input.outstandingBalance !== undefined) changes.outstandingBalance = input.outstandingBalance.toString();
  return customerRepository.update(db, companyId, id, changes);
}

export async function deleteCustomer(db: DbClient, companyId: string, id: string): Promise<void> {
  return customerRepository.delete(db, companyId, id);
}

// Called by salesService inside the same sale transaction: records a purchase and,
// if the sale wasn't fully paid, grows the customer's receivable balance.
export async function recordPurchaseOnAccount(db: DbClient, companyId: string, customerId: string, shortfall: number): Promise<void> {
  await customerRepository.incrementTotalPurchases(db, companyId, customerId, 1);
  if (shortfall > 0) {
    await customerRepository.incrementOutstandingBalance(db, companyId, customerId, shortfall);
  }
}

// Called by vouchersService when a receipt (قبض) voucher is recorded against a customer.
export async function settleOutstandingBalance(db: DbClient, companyId: string, customerId: string, amount: number): Promise<void> {
  await customerRepository.incrementOutstandingBalance(db, companyId, customerId, -amount);
}

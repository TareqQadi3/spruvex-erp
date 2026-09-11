import type { PaymentMethod } from "@workspace/db";
import { paymentMethodRepository, type PaymentMethodUpdate } from "../repositories/paymentMethodRepository";
import type { DbClient } from "../../accounting/types";

export interface CreatePaymentMethodInput {
  name: string;
  percentFee?: number;
  fixedFee?: number;
  showFeeToCustomer?: boolean;
}

export interface UpdatePaymentMethodInput {
  name?: string;
  percentFee?: number;
  fixedFee?: number;
  showFeeToCustomer?: boolean;
  isActive?: boolean;
}

export async function listPaymentMethods(db: DbClient, companyId: string): Promise<PaymentMethod[]> {
  return paymentMethodRepository.list(db, companyId);
}

export async function createPaymentMethod(db: DbClient, companyId: string, input: CreatePaymentMethodInput): Promise<PaymentMethod> {
  if (!input.name) throw new Error("name is required");
  return paymentMethodRepository.insert(db, {
    companyId,
    name: input.name,
    percentFee: (input.percentFee ?? 0).toString(),
    fixedFee: (input.fixedFee ?? 0).toString(),
    showFeeToCustomer: input.showFeeToCustomer ?? true,
  });
}

export async function updatePaymentMethod(db: DbClient, companyId: string, id: string, input: UpdatePaymentMethodInput): Promise<PaymentMethod | undefined> {
  const changes: PaymentMethodUpdate = {};
  if (input.name !== undefined) changes.name = input.name;
  if (input.percentFee !== undefined) changes.percentFee = input.percentFee.toString();
  if (input.fixedFee !== undefined) changes.fixedFee = input.fixedFee.toString();
  if (input.showFeeToCustomer !== undefined) changes.showFeeToCustomer = input.showFeeToCustomer;
  if (input.isActive !== undefined) changes.isActive = input.isActive;
  return paymentMethodRepository.update(db, companyId, id, changes);
}

export async function deletePaymentMethod(db: DbClient, companyId: string, id: string): Promise<void> {
  await paymentMethodRepository.delete(db, companyId, id);
}

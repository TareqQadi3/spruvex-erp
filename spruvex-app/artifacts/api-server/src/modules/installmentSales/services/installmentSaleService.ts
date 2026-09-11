import { db, type InstallmentSale, type InstallmentPayment } from "@workspace/db";
import { installmentSaleRepository } from "../repositories/installmentSaleRepository";

export async function listInstallmentSales(companyId: string, saleId?: string): Promise<InstallmentSale[]> {
  return installmentSaleRepository.list(db, companyId, saleId);
}

export interface CreateInstallmentSaleInput {
  saleId?: string;
  customerId?: string;
  planId: string;
  principal: number;
  downPayment?: number;
}

export class NotFoundError extends Error {}

export async function createInstallmentSale(companyId: string, input: CreateInstallmentSaleInput): Promise<{ installmentSale: InstallmentSale; payments: InstallmentPayment[] }> {
  if (!input.principal) throw new Error("principal is required");
  if (!input.planId) throw new Error("planId is required");

  const plan = await installmentSaleRepository.findPlan(db, companyId, input.planId);
  if (!plan) throw new NotFoundError("Installment plan not found");

  if (input.saleId) {
    const sale = await installmentSaleRepository.findSale(db, companyId, input.saleId);
    if (!sale) throw new NotFoundError("Sale not found");
  }

  const principalNum = Number(input.principal);
  const downPaymentNum = Number(input.downPayment) || 0;
  const interestPercent = Number(plan.interestPercent);
  const months = plan.months;
  const totalAmount = principalNum * (1 + interestPercent / 100);
  const financedAmount = totalAmount - downPaymentNum;
  const monthlyAmount = financedAmount / months;

  return db.transaction(async (tx) => {
    const installmentSale = await installmentSaleRepository.insert(tx, {
      companyId,
      customerId: input.customerId ?? null,
      saleId: input.saleId ?? null,
      principal: principalNum.toFixed(2),
      interestPercent: interestPercent.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      months,
      monthlyAmount: monthlyAmount.toFixed(2),
      downPayment: downPaymentNum.toFixed(2),
      startDate: new Date().toISOString().slice(0, 10),
    });

    const startDate = new Date();
    const paymentRows = Array.from({ length: months }, (_, i) => {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i + 1);
      return {
        companyId,
        installmentSaleId: installmentSale.id,
        amount: monthlyAmount.toFixed(2),
        dueDate: dueDate.toISOString().slice(0, 10),
      };
    });
    const payments = await installmentSaleRepository.insertPayments(tx, paymentRows);

    return { installmentSale, payments };
  });
}

export interface InstallmentSaleWithPayments extends InstallmentSale {
  payments: InstallmentPayment[];
}

export async function getInstallmentSale(companyId: string, id: string): Promise<InstallmentSaleWithPayments | undefined> {
  const installmentSale = await installmentSaleRepository.findById(db, companyId, id);
  if (!installmentSale) return undefined;
  const payments = await installmentSaleRepository.listPayments(db, companyId, id);
  return { ...installmentSale, payments };
}

export class AlreadyPaidError extends Error {}

export async function payInstallment(companyId: string, id: string, paymentId: string): Promise<InstallmentPayment> {
  const payment = await installmentSaleRepository.findPayment(db, companyId, id, paymentId);
  if (!payment) throw new NotFoundError("Not found");
  if (payment.isPaid) throw new AlreadyPaidError("Payment already recorded");

  const updated = await installmentSaleRepository.markPaymentPaid(db, paymentId, new Date().toISOString().slice(0, 10));

  const remaining = await installmentSaleRepository.listUnpaidPayments(db, id);
  if (remaining.length === 0) {
    await installmentSaleRepository.markSaleCompleted(db, id);
  }

  return updated;
}

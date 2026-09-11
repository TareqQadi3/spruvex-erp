import { eq, and } from "drizzle-orm";
import {
  installmentSalesTable, installmentPaymentsTable, installmentPlansTable, salesTable,
  type InstallmentSale, type InstallmentPlan, type InstallmentPayment,
} from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface InsertInstallmentSaleRow {
  companyId: string;
  customerId: string | null;
  saleId: string | null;
  principal: string;
  interestPercent: string;
  totalAmount: string;
  months: number;
  monthlyAmount: string;
  downPayment: string;
  startDate: string;
}

export interface InsertInstallmentPaymentRow {
  companyId: string;
  installmentSaleId: string;
  amount: string;
  dueDate: string;
}

export interface IInstallmentSaleRepository {
  list(db: DbClient, companyId: string, saleId?: string): Promise<InstallmentSale[]>;
  findById(db: DbClient, companyId: string, id: string): Promise<InstallmentSale | undefined>;
  findPlan(db: DbClient, companyId: string, planId: string): Promise<InstallmentPlan | undefined>;
  findSale(db: DbClient, companyId: string, saleId: string): Promise<{ id: string } | undefined>;
  insert(db: DbClient, row: InsertInstallmentSaleRow): Promise<InstallmentSale>;
  insertPayments(db: DbClient, rows: InsertInstallmentPaymentRow[]): Promise<InstallmentPayment[]>;
  listPayments(db: DbClient, companyId: string, installmentSaleId: string): Promise<InstallmentPayment[]>;
  findPayment(db: DbClient, companyId: string, installmentSaleId: string, paymentId: string): Promise<InstallmentPayment | undefined>;
  markPaymentPaid(db: DbClient, paymentId: string, paidDate: string): Promise<InstallmentPayment>;
  listUnpaidPayments(db: DbClient, installmentSaleId: string): Promise<InstallmentPayment[]>;
  markSaleCompleted(db: DbClient, id: string): Promise<void>;
}

export const installmentSaleRepository: IInstallmentSaleRepository = {
  async list(db, companyId, saleId) {
    const conditions = [eq(installmentSalesTable.companyId, companyId)];
    if (saleId) conditions.push(eq(installmentSalesTable.saleId, saleId));
    return db.select().from(installmentSalesTable).where(and(...conditions)).orderBy(installmentSalesTable.createdAt);
  },

  async findById(db, companyId, id) {
    const [row] = await db.select().from(installmentSalesTable)
      .where(and(eq(installmentSalesTable.id, id), eq(installmentSalesTable.companyId, companyId)));
    return row;
  },

  async findPlan(db, companyId, planId) {
    const [plan] = await db.select().from(installmentPlansTable)
      .where(and(eq(installmentPlansTable.id, planId), eq(installmentPlansTable.companyId, companyId)));
    return plan;
  },

  async findSale(db, companyId, saleId) {
    const [sale] = await db.select({ id: salesTable.id }).from(salesTable)
      .where(and(eq(salesTable.id, saleId), eq(salesTable.companyId, companyId)));
    return sale;
  },

  async insert(db, row) {
    const [installmentSale] = await db.insert(installmentSalesTable).values(row).returning();
    return installmentSale;
  },

  async insertPayments(db, rows) {
    if (rows.length === 0) return [];
    return db.insert(installmentPaymentsTable).values(rows).returning();
  },

  async listPayments(db, companyId, installmentSaleId) {
    return db.select().from(installmentPaymentsTable)
      .where(and(eq(installmentPaymentsTable.installmentSaleId, installmentSaleId), eq(installmentPaymentsTable.companyId, companyId)))
      .orderBy(installmentPaymentsTable.dueDate);
  },

  async findPayment(db, companyId, installmentSaleId, paymentId) {
    const [payment] = await db.select().from(installmentPaymentsTable)
      .where(and(
        eq(installmentPaymentsTable.id, paymentId),
        eq(installmentPaymentsTable.installmentSaleId, installmentSaleId),
        eq(installmentPaymentsTable.companyId, companyId),
      ));
    return payment;
  },

  async markPaymentPaid(db, paymentId, paidDate) {
    const [updated] = await db.update(installmentPaymentsTable).set({ isPaid: true, paidDate })
      .where(eq(installmentPaymentsTable.id, paymentId)).returning();
    return updated;
  },

  async listUnpaidPayments(db, installmentSaleId) {
    return db.select().from(installmentPaymentsTable)
      .where(and(eq(installmentPaymentsTable.installmentSaleId, installmentSaleId), eq(installmentPaymentsTable.isPaid, false)));
  },

  async markSaleCompleted(db, id) {
    await db.update(installmentSalesTable).set({ status: "completed" }).where(eq(installmentSalesTable.id, id));
  },
};

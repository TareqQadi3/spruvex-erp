import { eq, and } from "drizzle-orm";
import { paymentMethodsTable, type PaymentMethod, type InsertPaymentMethod } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface PaymentMethodUpdate {
  name?: string;
  percentFee?: string;
  fixedFee?: string;
  showFeeToCustomer?: boolean;
  isActive?: boolean;
}

export interface IPaymentMethodRepository {
  list(db: DbClient, companyId: string): Promise<PaymentMethod[]>;
  insert(db: DbClient, row: InsertPaymentMethod): Promise<PaymentMethod>;
  update(db: DbClient, companyId: string, id: string, changes: PaymentMethodUpdate): Promise<PaymentMethod | undefined>;
  delete(db: DbClient, companyId: string, id: string): Promise<void>;
}

export const paymentMethodRepository: IPaymentMethodRepository = {
  async list(db, companyId) {
    return db.select().from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.companyId, companyId))
      .orderBy(paymentMethodsTable.name);
  },

  async insert(db, row) {
    const [method] = await db.insert(paymentMethodsTable).values(row).returning();
    return method;
  },

  async update(db, companyId, id, changes) {
    const [updated] = await db.update(paymentMethodsTable).set(changes)
      .where(and(eq(paymentMethodsTable.id, id), eq(paymentMethodsTable.companyId, companyId)))
      .returning();
    return updated;
  },

  async delete(db, companyId, id) {
    await db.delete(paymentMethodsTable)
      .where(and(eq(paymentMethodsTable.id, id), eq(paymentMethodsTable.companyId, companyId)));
  },
};

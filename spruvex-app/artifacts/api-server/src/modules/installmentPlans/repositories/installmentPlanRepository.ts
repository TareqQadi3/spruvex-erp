import { eq, and } from "drizzle-orm";
import { installmentPlansTable, type InstallmentPlan } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface InstallmentPlanUpdate {
  months?: number;
  interestPercent?: string;
  isActive?: boolean;
}

export interface InsertInstallmentPlanRow {
  companyId: string;
  months: number;
  interestPercent: string;
}

export interface IInstallmentPlanRepository {
  list(db: DbClient, companyId: string): Promise<InstallmentPlan[]>;
  insert(db: DbClient, row: InsertInstallmentPlanRow): Promise<InstallmentPlan>;
  update(db: DbClient, companyId: string, id: string, changes: InstallmentPlanUpdate): Promise<InstallmentPlan | undefined>;
  delete(db: DbClient, companyId: string, id: string): Promise<void>;
}

export const installmentPlanRepository: IInstallmentPlanRepository = {
  async list(db, companyId) {
    return db.select().from(installmentPlansTable)
      .where(eq(installmentPlansTable.companyId, companyId))
      .orderBy(installmentPlansTable.months);
  },

  async insert(db, row) {
    const [plan] = await db.insert(installmentPlansTable).values(row).returning();
    return plan;
  },

  async update(db, companyId, id, changes) {
    const [plan] = await db.update(installmentPlansTable).set(changes)
      .where(and(eq(installmentPlansTable.id, id), eq(installmentPlansTable.companyId, companyId)))
      .returning();
    return plan;
  },

  async delete(db, companyId, id) {
    await db.delete(installmentPlansTable)
      .where(and(eq(installmentPlansTable.id, id), eq(installmentPlansTable.companyId, companyId)));
  },
};

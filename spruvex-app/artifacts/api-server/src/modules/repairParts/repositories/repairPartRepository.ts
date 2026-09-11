import { eq, and } from "drizzle-orm";
import { repairPartsTable, productsTable, type RepairPart } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface InsertRepairPartRow {
  companyId: string;
  repairId: string;
  productId: string | null;
  partName: string;
  quantity: number;
  partCost: string;
  laborFee: string;
}

export interface RepairPartUpdate {
  partName?: string;
  quantity?: number;
  partCost?: string;
  laborFee?: string;
  productId?: string;
}

export const repairPartRepository = {
  async listByRepair(db: DbClient, companyId: string, repairId: string): Promise<RepairPart[]> {
    return db.select().from(repairPartsTable)
      .where(and(eq(repairPartsTable.companyId, companyId), eq(repairPartsTable.repairId, repairId)))
      .orderBy(repairPartsTable.id);
  },

  async findProduct(db: DbClient, companyId: string, productId: string) {
    const [product] = await db.select().from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.companyId, companyId)));
    return product;
  },

  async insert(db: DbClient, row: InsertRepairPartRow): Promise<RepairPart> {
    const [part] = await db.insert(repairPartsTable).values(row).returning();
    return part;
  },

  async update(db: DbClient, companyId: string, id: string, changes: RepairPartUpdate): Promise<RepairPart | undefined> {
    const [updated] = await db.update(repairPartsTable).set(changes)
      .where(and(eq(repairPartsTable.id, id), eq(repairPartsTable.companyId, companyId)))
      .returning();
    return updated;
  },

  async findById(db: DbClient, companyId: string, id: string): Promise<RepairPart | undefined> {
    const [part] = await db.select().from(repairPartsTable)
      .where(and(eq(repairPartsTable.id, id), eq(repairPartsTable.companyId, companyId)));
    return part;
  },

  async delete(db: DbClient, companyId: string, id: string): Promise<void> {
    await db.delete(repairPartsTable)
      .where(and(eq(repairPartsTable.id, id), eq(repairPartsTable.companyId, companyId)));
  },
};

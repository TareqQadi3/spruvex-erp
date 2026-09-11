import { eq } from "drizzle-orm";
import { unitsTable, type Unit, type InsertUnit } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface IUnitRepository {
  list(db: DbClient, companyId: string): Promise<Unit[]>;
  insert(db: DbClient, row: InsertUnit): Promise<Unit>;
}

export const unitRepository: IUnitRepository = {
  async list(db, companyId) {
    return db.select().from(unitsTable)
      .where(eq(unitsTable.companyId, companyId))
      .orderBy(unitsTable.nameAr);
  },

  async insert(db, row) {
    const [unit] = await db.insert(unitsTable).values(row).returning();
    return unit;
  },
};

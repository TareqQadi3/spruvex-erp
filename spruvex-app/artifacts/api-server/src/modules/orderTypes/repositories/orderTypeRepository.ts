import { eq, and } from "drizzle-orm";
import { orderTypesTable, type OrderType, type InsertOrderType } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface IOrderTypeRepository {
  listActive(db: DbClient, companyId: string): Promise<OrderType[]>;
  insertMany(db: DbClient, rows: InsertOrderType[]): Promise<OrderType[]>;
  insert(db: DbClient, row: InsertOrderType): Promise<OrderType>;
}

export const orderTypeRepository: IOrderTypeRepository = {
  async listActive(db, companyId) {
    return db.select().from(orderTypesTable)
      .where(and(eq(orderTypesTable.companyId, companyId), eq(orderTypesTable.isActive, true)))
      .orderBy(orderTypesTable.sortOrder);
  },

  async insertMany(db, rows) {
    return db.insert(orderTypesTable).values(rows).returning();
  },

  async insert(db, row) {
    const [type] = await db.insert(orderTypesTable).values(row).returning();
    return type;
  },
};

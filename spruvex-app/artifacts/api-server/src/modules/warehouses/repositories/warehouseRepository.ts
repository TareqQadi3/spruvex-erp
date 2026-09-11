import { eq, and } from "drizzle-orm";
import {
  warehousesTable, warehouseSectionsTable,
  type Warehouse, type InsertWarehouse,
  type WarehouseSection, type InsertWarehouseSection,
} from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface WarehouseUpdate {
  name?: string;
  isRepairStock?: boolean;
  isDefault?: boolean;
  branchId?: string | null;
}

export interface IWarehouseRepository {
  list(db: DbClient, companyId: string, branchId?: string): Promise<Warehouse[]>;
  insert(db: DbClient, row: InsertWarehouse): Promise<Warehouse>;
  update(db: DbClient, companyId: string, id: string, changes: WarehouseUpdate): Promise<Warehouse | undefined>;
  delete(db: DbClient, companyId: string, id: string): Promise<void>;
  clearExistingDefault(db: DbClient, companyId: string): Promise<void>;
  listSections(db: DbClient, companyId: string, warehouseId?: string): Promise<WarehouseSection[]>;
  insertSection(db: DbClient, row: InsertWarehouseSection): Promise<WarehouseSection>;
  deleteSection(db: DbClient, companyId: string, id: string): Promise<void>;
}

export const warehouseRepository: IWarehouseRepository = {
  async list(db, companyId, branchId) {
    const conditions = [eq(warehousesTable.companyId, companyId)];
    if (branchId) conditions.push(eq(warehousesTable.branchId, branchId));
    return db.select().from(warehousesTable).where(and(...conditions)).orderBy(warehousesTable.name);
  },

  async insert(db, row) {
    const [warehouse] = await db.insert(warehousesTable).values(row).returning();
    return warehouse;
  },

  async update(db, companyId, id, changes) {
    const [warehouse] = await db.update(warehousesTable).set(changes)
      .where(and(eq(warehousesTable.id, id), eq(warehousesTable.companyId, companyId)))
      .returning();
    return warehouse;
  },

  async delete(db, companyId, id) {
    await db.delete(warehousesTable)
      .where(and(eq(warehousesTable.id, id), eq(warehousesTable.companyId, companyId)));
  },

  // Exactly one default per company — callers run this inside the same
  // transaction as the insert/update that sets the new default, so a failed
  // write never leaves zero or two defaults.
  async clearExistingDefault(db, companyId) {
    await db.update(warehousesTable).set({ isDefault: false })
      .where(and(eq(warehousesTable.companyId, companyId), eq(warehousesTable.isDefault, true)));
  },

  async listSections(db, companyId, warehouseId) {
    const conditions = [eq(warehouseSectionsTable.companyId, companyId)];
    if (warehouseId) conditions.push(eq(warehouseSectionsTable.warehouseId, warehouseId));
    return db.select().from(warehouseSectionsTable).where(and(...conditions)).orderBy(warehouseSectionsTable.name);
  },

  async insertSection(db, row) {
    const [section] = await db.insert(warehouseSectionsTable).values(row).returning();
    return section;
  },

  async deleteSection(db, companyId, id) {
    await db.delete(warehouseSectionsTable)
      .where(and(eq(warehouseSectionsTable.id, id), eq(warehouseSectionsTable.companyId, companyId)));
  },
};

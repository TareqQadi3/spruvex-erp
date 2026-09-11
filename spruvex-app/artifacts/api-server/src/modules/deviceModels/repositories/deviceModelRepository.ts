import { eq, and } from "drizzle-orm";
import { deviceModelsTable, type DeviceModel, type InsertDeviceModel } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface IDeviceModelRepository {
  list(db: DbClient, companyId: string, brandId?: string): Promise<DeviceModel[]>;
  findByBrandAndName(db: DbClient, companyId: string, brandId: string, name: string): Promise<DeviceModel | undefined>;
  insertIfAbsent(db: DbClient, row: InsertDeviceModel): Promise<DeviceModel | undefined>;
  delete(db: DbClient, companyId: string, id: string): Promise<void>;
}

export const deviceModelRepository: IDeviceModelRepository = {
  async list(db, companyId, brandId) {
    const conditions = [eq(deviceModelsTable.companyId, companyId)];
    if (brandId) conditions.push(eq(deviceModelsTable.brandId, brandId));
    return db.select().from(deviceModelsTable)
      .where(and(...conditions))
      .orderBy(deviceModelsTable.name);
  },

  async findByBrandAndName(db, companyId, brandId, name) {
    const [existing] = await db.select().from(deviceModelsTable)
      .where(and(eq(deviceModelsTable.companyId, companyId), eq(deviceModelsTable.brandId, brandId), eq(deviceModelsTable.name, name)));
    return existing;
  },

  async insertIfAbsent(db, row) {
    const [model] = await db.insert(deviceModelsTable).values(row).onConflictDoNothing().returning();
    return model;
  },

  async delete(db, companyId, id) {
    await db.delete(deviceModelsTable)
      .where(and(eq(deviceModelsTable.id, id), eq(deviceModelsTable.companyId, companyId)));
  },
};

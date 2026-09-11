import { eq } from "drizzle-orm";
import { settingsTable, companiesTable, type Settings, type Company } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface ISettingsRepository {
  findByCompanyId(db: DbClient, companyId: string): Promise<Settings | undefined>;
  insertDefault(db: DbClient, companyId: string): Promise<Settings>;
  update(db: DbClient, id: string, patch: Record<string, unknown>): Promise<Settings>;
  findCompany(db: DbClient, companyId: string): Promise<Company | undefined>;
  updateCompany(db: DbClient, companyId: string, patch: Record<string, string>): Promise<void>;
}

export const settingsRepository: ISettingsRepository = {
  async findByCompanyId(db, companyId) {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.companyId, companyId)).limit(1);
    return row;
  },

  async insertDefault(db, companyId) {
    const [created] = await db.insert(settingsTable).values({ companyId }).returning();
    return created;
  },

  async update(db, id, patch) {
    const [updated] = await db.update(settingsTable).set(patch).where(eq(settingsTable.id, id)).returning();
    return updated;
  },

  async findCompany(db, companyId) {
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
    return company;
  },

  async updateCompany(db, companyId, patch) {
    await db.update(companiesTable).set(patch).where(eq(companiesTable.id, companyId));
  },
};

import { eq, and } from "drizzle-orm";
import { companiesTable, categoriesTable, productsTable, warehousesTable, type Company, type Category, type Product, type Warehouse } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface SeedProductInput {
  companyId: string;
  name: string;
  nameEn?: string;
  sku: string;
  sellingPrice: string;
  stock: number;
  categoryId: string;
  warehouseId?: string;
  isService?: boolean;
}

export interface IOnboardingRepository {
  findCompany(db: DbClient, companyId: string): Promise<Company | undefined>;
  findDefaultWarehouse(db: DbClient, companyId: string): Promise<Warehouse | undefined>;
  insertCategory(db: DbClient, row: { companyId: string; name: string; nameEn?: string; parentId?: string }): Promise<Category>;
  insertProducts(db: DbClient, rows: SeedProductInput[]): Promise<Product[]>;
}

export const onboardingRepository: IOnboardingRepository = {
  async findCompany(db, companyId) {
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
    return company;
  },

  async findDefaultWarehouse(db, companyId) {
    const [warehouse] = await db.select().from(warehousesTable)
      .where(and(eq(warehousesTable.companyId, companyId), eq(warehousesTable.isDefault, true)))
      .limit(1);
    return warehouse;
  },

  async insertCategory(db, row) {
    const [category] = await db.insert(categoriesTable).values(row).returning();
    return category;
  },

  async insertProducts(db, rows) {
    return db.insert(productsTable).values(rows).returning();
  },
};

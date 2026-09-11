import { eq, and } from "drizzle-orm";
import { categoriesTable, productsTable, type Category, type InsertCategory } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface CategoryUpdate {
  name?: string;
  nameEn?: string;
  description?: string;
  parentId?: string | null;
  imageUrl?: string;
  displayMode?: string;
}

export interface ICategoryRepository {
  list(db: DbClient, companyId: string): Promise<Category[]>;
  insert(db: DbClient, row: InsertCategory): Promise<Category>;
  update(db: DbClient, companyId: string, id: string, changes: CategoryUpdate): Promise<Category | undefined>;
  delete(db: DbClient, companyId: string, id: string): Promise<void>;
  findProductUsingCategory(db: DbClient, companyId: string, categoryId: string): Promise<{ id: string } | undefined>;
  findChildCategory(db: DbClient, companyId: string, parentId: string): Promise<{ id: string } | undefined>;
}

export const categoryRepository: ICategoryRepository = {
  async list(db, companyId) {
    return db.select().from(categoriesTable)
      .where(eq(categoriesTable.companyId, companyId))
      .orderBy(categoriesTable.name);
  },

  async insert(db, row) {
    const [category] = await db.insert(categoriesTable).values(row).returning();
    return category;
  },

  async update(db, companyId, id, changes) {
    const [category] = await db.update(categoriesTable).set(changes)
      .where(and(eq(categoriesTable.id, id), eq(categoriesTable.companyId, companyId)))
      .returning();
    return category;
  },

  async delete(db, companyId, id) {
    await db.delete(categoriesTable)
      .where(and(eq(categoriesTable.id, id), eq(categoriesTable.companyId, companyId)));
  },

  async findProductUsingCategory(db, companyId, categoryId) {
    const [product] = await db.select({ id: productsTable.id }).from(productsTable)
      .where(and(eq(productsTable.categoryId, categoryId), eq(productsTable.companyId, companyId))).limit(1);
    return product;
  },

  async findChildCategory(db, companyId, parentId) {
    const [child] = await db.select({ id: categoriesTable.id }).from(categoriesTable)
      .where(and(eq(categoriesTable.parentId, parentId), eq(categoriesTable.companyId, companyId))).limit(1);
    return child;
  },
};

import { eq, and, ilike } from "drizzle-orm";
import { brandsTable, productsTable, type Brand, type InsertBrand } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface BrandUpdate {
  name?: string;
  imageUrl?: string | null;
}

export interface IBrandRepository {
  list(db: DbClient, companyId: string): Promise<Brand[]>;
  findById(db: DbClient, companyId: string, id: string): Promise<Brand | undefined>;
  insert(db: DbClient, row: InsertBrand): Promise<Brand>;
  update(db: DbClient, companyId: string, id: string, changes: BrandUpdate): Promise<Brand | undefined>;
  delete(db: DbClient, companyId: string, id: string): Promise<void>;
  findProductUsingBrand(db: DbClient, companyId: string, brandName: string): Promise<{ id: string } | undefined>;
}

export const brandRepository: IBrandRepository = {
  async list(db, companyId) {
    return db.select().from(brandsTable)
      .where(eq(brandsTable.companyId, companyId))
      .orderBy(brandsTable.name);
  },

  async findById(db, companyId, id) {
    const [brand] = await db.select().from(brandsTable)
      .where(and(eq(brandsTable.id, id), eq(brandsTable.companyId, companyId)));
    return brand;
  },

  async insert(db, row) {
    const [brand] = await db.insert(brandsTable).values(row).returning();
    return brand;
  },

  async update(db, companyId, id, changes) {
    const [brand] = await db.update(brandsTable).set(changes)
      .where(and(eq(brandsTable.id, id), eq(brandsTable.companyId, companyId)))
      .returning();
    return brand;
  },

  async delete(db, companyId, id) {
    await db.delete(brandsTable)
      .where(and(eq(brandsTable.id, id), eq(brandsTable.companyId, companyId)));
  },

  // products.brand is free text (not an FK) — match by name the same way
  // products are saved. Mirrors the legacy route's in-use guard.
  async findProductUsingBrand(db, companyId, brandName) {
    const [product] = await db.select({ id: productsTable.id }).from(productsTable)
      .where(and(eq(productsTable.companyId, companyId), ilike(productsTable.brand, brandName))).limit(1);
    return product;
  },
};

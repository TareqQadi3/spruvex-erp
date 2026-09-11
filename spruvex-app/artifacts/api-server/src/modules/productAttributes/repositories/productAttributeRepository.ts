import { eq, and, inArray } from "drizzle-orm";
import {
  productAttributeDefinitionsTable, productAttributeValuesTable,
  type ProductAttributeDefinition, type InsertProductAttributeDefinition,
  type ProductAttributeValue, type InsertProductAttributeValue,
} from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface IProductAttributeRepository {
  listDefinitions(db: DbClient, companyId: string): Promise<ProductAttributeDefinition[]>;
  listValuesForDefinitions(db: DbClient, definitionIds: string[]): Promise<ProductAttributeValue[]>;
  insertDefinition(db: DbClient, row: InsertProductAttributeDefinition): Promise<ProductAttributeDefinition>;
  findOwnDefinition(db: DbClient, companyId: string, id: string): Promise<ProductAttributeDefinition | undefined>;
  insertValue(db: DbClient, row: InsertProductAttributeValue): Promise<ProductAttributeValue>;
}

export const productAttributeRepository: IProductAttributeRepository = {
  async listDefinitions(db, companyId) {
    return db.select().from(productAttributeDefinitionsTable)
      .where(eq(productAttributeDefinitionsTable.companyId, companyId))
      .orderBy(productAttributeDefinitionsTable.sortOrder);
  },

  async listValuesForDefinitions(db, definitionIds) {
    if (definitionIds.length === 0) return [];
    return db.select().from(productAttributeValuesTable)
      .where(inArray(productAttributeValuesTable.attributeDefinitionId, definitionIds))
      .orderBy(productAttributeValuesTable.sortOrder);
  },

  async insertDefinition(db, row) {
    const [definition] = await db.insert(productAttributeDefinitionsTable).values(row).returning();
    return definition;
  },

  async findOwnDefinition(db, companyId, id) {
    const [own] = await db.select().from(productAttributeDefinitionsTable)
      .where(and(eq(productAttributeDefinitionsTable.id, id), eq(productAttributeDefinitionsTable.companyId, companyId)));
    return own;
  },

  async insertValue(db, row) {
    const [created] = await db.insert(productAttributeValuesTable).values(row).returning();
    return created;
  },
};

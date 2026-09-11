import type { ProductAttributeDefinition, ProductAttributeValue } from "@workspace/db";
import { productAttributeRepository } from "../repositories/productAttributeRepository";
import type { DbClient } from "../../accounting/types";

export interface DefinitionWithValues extends ProductAttributeDefinition {
  values: ProductAttributeValue[];
}

export interface CreateDefinitionInput {
  name: string;
  nameEn?: string;
}

export interface CreateValueInput {
  value: string;
  valueEn?: string;
}

export async function listDefinitionsWithValues(db: DbClient, companyId: string): Promise<DefinitionWithValues[]> {
  const definitions = await productAttributeRepository.listDefinitions(db, companyId);
  if (definitions.length === 0) return [];
  const values = await productAttributeRepository.listValuesForDefinitions(db, definitions.map(d => d.id));
  return definitions.map(d => ({ ...d, values: values.filter(v => v.attributeDefinitionId === d.id) }));
}

export async function createDefinition(db: DbClient, companyId: string, input: CreateDefinitionInput): Promise<DefinitionWithValues> {
  if (!input.name) throw new Error("name is required");
  const definition = await productAttributeRepository.insertDefinition(db, { companyId, name: input.name, nameEn: input.nameEn });
  return { ...definition, values: [] };
}

export class NotFoundError extends Error {}

export async function createValue(db: DbClient, companyId: string, attributeDefinitionId: string, input: CreateValueInput): Promise<ProductAttributeValue> {
  if (!input.value) throw new Error("value is required");
  const own = await productAttributeRepository.findOwnDefinition(db, companyId, attributeDefinitionId);
  if (!own) throw new NotFoundError("Not found");
  return productAttributeRepository.insertValue(db, { attributeDefinitionId, value: input.value, valueEn: input.valueEn });
}

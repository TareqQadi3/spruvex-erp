import type { Brand } from "@workspace/db";
import { brandRepository, type BrandUpdate } from "../repositories/brandRepository";
import type { DbClient } from "../../accounting/types";

export interface CreateBrandInput {
  name: string;
  imageUrl?: string;
}

export type DeleteBrandResult = "deleted" | "not-found" | "in-use";

export async function listBrands(db: DbClient, companyId: string): Promise<Brand[]> {
  return brandRepository.list(db, companyId);
}

export async function createBrand(db: DbClient, companyId: string, input: CreateBrandInput): Promise<Brand> {
  if (!input.name) throw new Error("name is required");
  return brandRepository.insert(db, { companyId, name: input.name, imageUrl: input.imageUrl });
}

export async function updateBrand(db: DbClient, companyId: string, id: string, input: Partial<CreateBrandInput>): Promise<Brand | undefined> {
  const changes: BrandUpdate = {};
  if (input.name !== undefined) changes.name = input.name;
  if (input.imageUrl !== undefined) changes.imageUrl = input.imageUrl;
  return brandRepository.update(db, companyId, id, changes);
}

export async function deleteBrand(db: DbClient, companyId: string, id: string): Promise<DeleteBrandResult> {
  const brand = await brandRepository.findById(db, companyId, id);
  if (!brand) return "not-found";
  const productInUse = await brandRepository.findProductUsingBrand(db, companyId, brand.name);
  if (productInUse) return "in-use";
  await brandRepository.delete(db, companyId, id);
  return "deleted";
}

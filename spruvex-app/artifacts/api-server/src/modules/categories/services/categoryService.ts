import type { Category } from "@workspace/db";
import { categoryRepository, type CategoryUpdate } from "../repositories/categoryRepository";
import type { DbClient } from "../../accounting/types";

export interface CreateCategoryInput {
  name: string;
  nameEn?: string;
  description?: string;
  parentId?: string | null;
  imageUrl?: string;
  displayMode?: string;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

export class SelfParentError extends Error {}
export type DeleteCategoryResult = "deleted" | "has-products" | "has-children";

export async function listCategories(db: DbClient, companyId: string): Promise<Category[]> {
  return categoryRepository.list(db, companyId);
}

export async function createCategory(db: DbClient, companyId: string, input: CreateCategoryInput): Promise<Category> {
  if (!input.name) throw new Error("name is required");
  return categoryRepository.insert(db, {
    companyId, name: input.name, nameEn: input.nameEn, description: input.description,
    parentId: input.parentId ?? null, imageUrl: input.imageUrl, displayMode: input.displayMode,
  });
}

export async function updateCategory(db: DbClient, companyId: string, id: string, input: UpdateCategoryInput): Promise<Category | undefined> {
  if (input.parentId === id) throw new SelfParentError("A category cannot be its own parent");
  // Nesting is now unlimited depth (categories.tsx lets any category be
  // picked as a parent, not just top-level ones) — a direct self-parent
  // check alone no longer catches a deeper cycle (e.g. reparenting A under
  // its own grandchild). Walk the proposed parent's ancestor chain in memory
  // (one query, tree depths are always small) and reject if `id` appears in it.
  if (input.parentId) {
    const all = await categoryRepository.list(db, companyId);
    const parentById = new Map(all.map((c) => [c.id, c.parentId]));
    let cursor: string | null | undefined = input.parentId;
    const seen = new Set<string>();
    while (cursor) {
      if (cursor === id) throw new SelfParentError("A category cannot be moved under one of its own sub-categories");
      if (seen.has(cursor)) break; // already-corrupt data — don't loop forever
      seen.add(cursor);
      cursor = parentById.get(cursor);
    }
  }
  const changes: CategoryUpdate = { name: input.name, description: input.description };
  if (input.nameEn !== undefined) changes.nameEn = input.nameEn;
  if (input.parentId !== undefined) changes.parentId = input.parentId;
  if (input.imageUrl !== undefined) changes.imageUrl = input.imageUrl;
  if (input.displayMode !== undefined) changes.displayMode = input.displayMode;
  return categoryRepository.update(db, companyId, id, changes);
}

export async function deleteCategory(db: DbClient, companyId: string, id: string): Promise<DeleteCategoryResult> {
  const productInUse = await categoryRepository.findProductUsingCategory(db, companyId, id);
  if (productInUse) return "has-products";
  const childCategory = await categoryRepository.findChildCategory(db, companyId, id);
  if (childCategory) return "has-children";
  await categoryRepository.delete(db, companyId, id);
  return "deleted";
}

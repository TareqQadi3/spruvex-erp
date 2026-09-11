import type { Category, Product } from "@workspace/db";
import { onboardingRepository } from "../repositories/onboardingRepository";
import type { DbClient } from "../../accounting/types";
import { getCatalogTemplate } from "../../../lib/businessCatalogTemplates";
import type { BusinessType } from "../../auth/types/auth.types";

export interface SeedCatalogResult {
  mainCategory: Category;
  subCategory: Category;
  products: Product[];
}

// Populates a brand-new tenant with one starter category/sub-category and a
// couple of example products matching its declared business type — the
// "First Setup Wizard" step 6 (اول قسم رئيسي / قسم فرعي / منتج) and the later
// opt-in prompt share this single endpoint. Safe to call more than once: each
// call inserts a fresh (differently-suffixed) set rather than erroring, since
// a merchant may legitimately want the starter set again after deleting it —
// but the wizard only ever calls it once per company in the normal flow.
export async function seedCatalog(db: DbClient, companyId: string): Promise<SeedCatalogResult> {
  const company = await onboardingRepository.findCompany(db, companyId);
  const businessType = (company?.businessType as BusinessType | null) ?? "other";
  const template = getCatalogTemplate(businessType);

  const warehouse = await onboardingRepository.findDefaultWarehouse(db, companyId);

  const mainCategory = await onboardingRepository.insertCategory(db, {
    companyId, name: template.name, nameEn: template.nameEn,
  });

  const subCategory = await onboardingRepository.insertCategory(db, {
    companyId, name: template.subcategory.name, nameEn: template.subcategory.nameEn, parentId: mainCategory.id,
  });

  const skuPrefix = `SEED-${Date.now().toString(36).toUpperCase()}`;
  const products = await onboardingRepository.insertProducts(db, template.products.map(p => ({
    companyId,
    name: p.name,
    nameEn: p.nameEn,
    sku: `${skuPrefix}-${p.skuSuffix}`,
    sellingPrice: p.sellingPrice.toString(),
    stock: 10,
    categoryId: subCategory.id,
    warehouseId: warehouse?.id,
  })));

  return { mainCategory, subCategory, products };
}

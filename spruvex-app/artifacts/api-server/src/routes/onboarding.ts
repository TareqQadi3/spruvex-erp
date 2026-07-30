import { Router } from "express";
import { db, companiesTable, categoriesTable, productsTable, warehousesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";
import { getCatalogTemplate } from "../lib/businessCatalogTemplates";
import type { BusinessType } from "../modules/auth/types/auth.types";

const router = Router();

// Populates a brand-new tenant with one starter category/sub-category and a
// couple of example products matching its declared business type — the
// "First Setup Wizard" step 6 (اول قسم رئيسي / قسم فرعي / منتج) and the later
// opt-in prompt share this single endpoint. Safe to call more than once: each
// call inserts a fresh (differently-suffixed) set rather than erroring, since
// a merchant may legitimately want the starter set again after deleting it —
// but the wizard only ever calls it once per company in the normal flow.
router.post("/seed-catalog", async (req: AuthedRequest, res) => {
  const companyId = req.user!.companyId;
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
  const businessType = (company?.businessType as BusinessType | null) ?? "other";
  const template = getCatalogTemplate(businessType);

  const [warehouse] = await db
    .select()
    .from(warehousesTable)
    .where(and(eq(warehousesTable.companyId, companyId), eq(warehousesTable.isDefault, true)))
    .limit(1);

  const [mainCategory] = await db.insert(categoriesTable).values({
    companyId,
    name: template.name,
    nameEn: template.nameEn,
  }).returning();

  const [subCategory] = await db.insert(categoriesTable).values({
    companyId,
    name: template.subcategory.name,
    nameEn: template.subcategory.nameEn,
    parentId: mainCategory.id,
  }).returning();

  const skuPrefix = `SEED-${Date.now().toString(36).toUpperCase()}`;
  const products = await db.insert(productsTable).values(
    template.products.map(p => ({
      companyId,
      name: p.name,
      nameEn: p.nameEn,
      sku: `${skuPrefix}-${p.skuSuffix}`,
      sellingPrice: p.sellingPrice.toString(),
      stock: 10,
      categoryId: subCategory.id,
      warehouseId: warehouse?.id,
    })),
  ).returning();

  res.status(201).json({ mainCategory, subCategory, products });
});

export default router;

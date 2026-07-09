import { Router } from "express";
import { db, productsTable, categoriesTable, suppliersTable } from "@workspace/db";
import { eq, and, ilike, lte, or, sql } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";
import { ValidationError, parseRequiredNumber, parseOptionalNumber, isUniqueViolation } from "../lib/validation";

const router = Router();

const PRODUCT_SELECT = {
  id: productsTable.id,
  name: productsTable.name,
  sku: productsTable.sku,
  barcode: productsTable.barcode,
  description: productsTable.description,
  costPrice: productsTable.costPrice,
  sellingPrice: productsTable.sellingPrice,
  stock: productsTable.stock,
  lowStockThreshold: productsTable.lowStockThreshold,
  categoryId: productsTable.categoryId,
  categoryName: categoriesTable.name,
  warehouseId: productsTable.warehouseId,
  sectionId: productsTable.sectionId,
  supplierId: productsTable.supplierId,
  supplierName: suppliersTable.name,
  brand: productsTable.brand,
  imageUrl: productsTable.imageUrl,
  includesTax: productsTable.includesTax,
  createdAt: productsTable.createdAt,
};

router.get("/barcode/:barcode", async (req: AuthedRequest, res) => {
  const [product] = await db
    .select(PRODUCT_SELECT)
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(and(eq(productsTable.barcode, String(req.params.barcode)), eq(productsTable.companyId, req.user!.companyId)));
  if (!product) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(product);
});

router.get("/", async (req: AuthedRequest, res) => {
  const search = req.query.search as string | undefined;
  const categoryId = req.query.categoryId as string | undefined;
  const lowStock = req.query.lowStock === "true";

  const base = db
    .select(PRODUCT_SELECT)
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id));

  const conditions = [eq(productsTable.companyId, req.user!.companyId)];
  if (search) {
    conditions.push(or(
      ilike(productsTable.name, `%${search}%`),
      ilike(productsTable.sku, `%${search}%`),
      ilike(productsTable.barcode, `%${search}%`),
    )!);
  }
  if (categoryId) conditions.push(eq(productsTable.categoryId, categoryId));
  if (lowStock) conditions.push(lte(productsTable.stock, productsTable.lowStockThreshold));

  const products = await base.$dynamic().where(and(...conditions)).orderBy(productsTable.name);
  res.json(products);
});

router.post("/", async (req: AuthedRequest, res) => {
  const { name, sku, barcode, description, costPrice, sellingPrice, stock, lowStockThreshold, categoryId, brand, imageUrl, warehouseId, sectionId, supplierId, includesTax } = req.body;
  if (!name || !sku) {
    res.status(400).json({ error: "name and sku are required" });
    return;
  }
  try {
    const [product] = await db.insert(productsTable).values({
      companyId: req.user!.companyId,
      name, sku, barcode: barcode || undefined, description,
      costPrice: (parseOptionalNumber(costPrice, "costPrice") ?? 0).toString(),
      sellingPrice: (parseOptionalNumber(sellingPrice, "sellingPrice") ?? 0).toString(),
      stock: parseOptionalNumber(stock, "stock") ?? 0,
      lowStockThreshold: parseOptionalNumber(lowStockThreshold, "lowStockThreshold") ?? 5,
      categoryId,
      brand,
      imageUrl,
      warehouseId,
      sectionId,
      supplierId,
      includesTax: includesTax ?? false,
    }).returning();
    res.status(201).json(product);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "A product with this SKU or barcode already exists" });
      return;
    }
    throw err;
  }
});

router.post("/bulk", async (req: AuthedRequest, res) => {
  const orgId = req.user!.companyId;
  const { products } = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    res.status(400).json({ error: "products array is required" });
    return;
  }

  const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.companyId, orgId));
  const categoryByName = new Map(categories.map(c => [c.name.trim().toLowerCase(), c.id]));

  let created = 0;
  const skipped: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < products.length; i++) {
    const row = products[i];
    const name = String(row.name ?? "").trim();
    const sku = String(row.sku ?? "").trim();
    if (!name || !sku) {
      skipped.push({ row: i + 1, error: "name and sku are required" });
      continue;
    }

    let categoryId: string | undefined;
    if (row.category) {
      const key = String(row.category).trim().toLowerCase();
      categoryId = categoryByName.get(key);
      if (!categoryId) {
        const [newCat] = await db.insert(categoriesTable).values({ companyId: orgId, name: String(row.category).trim() }).returning();
        categoryByName.set(key, newCat.id);
        categoryId = newCat.id;
      }
    }

    try {
      await db.insert(productsTable).values({
        companyId: orgId,
        name,
        sku,
        barcode: row.barcode ? String(row.barcode) : undefined,
        costPrice: row.costPrice != null ? String(row.costPrice) : "0",
        sellingPrice: row.sellingPrice != null ? String(row.sellingPrice) : "0",
        stock: row.stock != null ? Number(row.stock) : 0,
        lowStockThreshold: row.lowStockThreshold != null ? Number(row.lowStockThreshold) : 5,
        categoryId,
        brand: row.brand ? String(row.brand) : undefined,
        includesTax: false,
      });
      created++;
    } catch {
      skipped.push({ row: i + 1, error: "duplicate SKU or invalid data" });
    }
  }

  res.status(201).json({ created, skipped });
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const [product] = await db
    .select(PRODUCT_SELECT)
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(and(eq(productsTable.id, id), eq(productsTable.companyId, req.user!.companyId)));
  if (!product) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(product);
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const { name, sku, barcode, description, costPrice, sellingPrice, stock, lowStockThreshold, categoryId, brand, imageUrl, warehouseId, sectionId, supplierId, includesTax } = req.body;
  try {
    const [updated] = await db.update(productsTable).set({
      name, sku, barcode: barcode || null, description,
      ...(costPrice !== undefined ? { costPrice: parseRequiredNumber(costPrice, "costPrice").toString() } : {}),
      ...(sellingPrice !== undefined ? { sellingPrice: parseRequiredNumber(sellingPrice, "sellingPrice").toString() } : {}),
      ...(stock !== undefined ? { stock: parseRequiredNumber(stock, "stock") } : {}),
      ...(lowStockThreshold !== undefined ? { lowStockThreshold: parseRequiredNumber(lowStockThreshold, "lowStockThreshold") } : {}),
      categoryId,
      ...(brand !== undefined ? { brand } : {}),
      ...(imageUrl !== undefined ? { imageUrl } : {}),
      ...(warehouseId !== undefined ? { warehouseId } : {}),
      ...(sectionId !== undefined ? { sectionId } : {}),
      ...(supplierId !== undefined ? { supplierId } : {}),
      ...(includesTax !== undefined ? { includesTax } : {}),
    }).where(and(eq(productsTable.id, id), eq(productsTable.companyId, req.user!.companyId))).returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "A product with this SKU or barcode already exists" });
      return;
    }
    throw err;
  }
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  await db.delete(productsTable)
    .where(and(eq(productsTable.id, id), eq(productsTable.companyId, req.user!.companyId)));
  res.status(204).send();
});

export default router;

import { productRepository, type CreateProductInput, type UpdateProductInput, type ListFilters } from "../repositories/productRepository";
import { ValidationError, parseRequiredNumber, parseOptionalNumber } from "../../../lib/validation";
import { productsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../accounting/types";

export class ProductValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductValidationError";
  }
}

function parseProductFields(body: Record<string, unknown>) {
  const name = body.name as string | undefined;
  const nameEn = body.nameEn as string | undefined;
  const sku = body.sku as string | undefined;
  const barcode = body.barcode as string | undefined;
  const description = body.description as string | undefined;
  const costPrice = body.costPrice as string | number | undefined;
  const sellingPrice = body.sellingPrice as string | number | undefined;
  const minSellingPrice = body.minSellingPrice as string | number | null | undefined;
  const stock = body.stock as string | number | undefined;
  const lowStockThreshold = body.lowStockThreshold as string | number | undefined;
  const categoryId = body.categoryId as string | undefined;
  const brand = body.brand as string | undefined;
  const imageUrl = body.imageUrl as string | undefined;
  const warehouseId = body.warehouseId as string | undefined;
  const sectionId = body.sectionId as string | undefined;
  const supplierId = body.supplierId as string | undefined;
  const includesTax = body.includesTax as boolean | undefined;
  const parentProductId = body.parentProductId as string | undefined;
  const variantAttributes = body.variantAttributes as Record<string, string> | undefined;

  return { name, nameEn, sku, barcode, description, costPrice, sellingPrice, minSellingPrice, stock, lowStockThreshold, categoryId, brand, imageUrl, warehouseId, sectionId, supplierId, includesTax, parentProductId, variantAttributes };
}

function buildCreateInput(companyId: string, body: Record<string, unknown>): CreateProductInput {
  const f = parseProductFields(body);
  if (!f.name || !f.sku) throw new ProductValidationError("name and sku are required");

  return {
    companyId,
    name: f.name,
    nameEn: f.nameEn ?? null,
    sku: f.sku,
    barcode: f.barcode || undefined,
    description: f.description,
    costPrice: (parseOptionalNumber(f.costPrice, "costPrice") ?? 0).toString(),
    sellingPrice: (parseOptionalNumber(f.sellingPrice, "sellingPrice") ?? 0).toString(),
    minSellingPrice: f.minSellingPrice !== undefined && f.minSellingPrice !== null && f.minSellingPrice !== ""
      ? (parseOptionalNumber(f.minSellingPrice, "minSellingPrice") ?? 0).toString()
      : undefined,
    stock: parseOptionalNumber(f.stock, "stock") ?? 0,
    lowStockThreshold: parseOptionalNumber(f.lowStockThreshold, "lowStockThreshold") ?? 5,
    categoryId: f.categoryId,
    brand: f.brand,
    imageUrl: f.imageUrl,
    warehouseId: f.warehouseId,
    sectionId: f.sectionId,
    supplierId: f.supplierId,
    includesTax: f.includesTax ?? false,
    parentProductId: f.parentProductId,
    variantAttributes: f.variantAttributes ?? null,
  };
}

function buildUpdateChanges(body: Record<string, unknown>): Record<string, unknown> {
  const f = parseProductFields(body);
  const changes: Record<string, unknown> = {};

  if (f.name !== undefined) changes.name = f.name;
  if (f.nameEn !== undefined) changes.nameEn = f.nameEn ?? null;
  if (f.sku !== undefined) changes.sku = f.sku;
  if (f.barcode !== undefined) changes.barcode = f.barcode || null;
  if (f.description !== undefined) changes.description = f.description;
  if (f.costPrice !== undefined) changes.costPrice = parseRequiredNumber(f.costPrice, "costPrice").toString();
  if (f.sellingPrice !== undefined) changes.sellingPrice = parseRequiredNumber(f.sellingPrice, "sellingPrice").toString();
  if (f.minSellingPrice !== undefined) {
    changes.minSellingPrice = f.minSellingPrice === null || f.minSellingPrice === ""
      ? null
      : parseOptionalNumber(f.minSellingPrice, "minSellingPrice")?.toString() ?? null;
  }
  if (f.stock !== undefined) changes.stock = parseRequiredNumber(f.stock, "stock");
  if (f.lowStockThreshold !== undefined) changes.lowStockThreshold = parseRequiredNumber(f.lowStockThreshold, "lowStockThreshold");
  if (f.categoryId !== undefined) changes.categoryId = f.categoryId;
  if (f.brand !== undefined) changes.brand = f.brand;
  if (f.imageUrl !== undefined) changes.imageUrl = f.imageUrl;
  if (f.warehouseId !== undefined) changes.warehouseId = f.warehouseId;
  if (f.sectionId !== undefined) changes.sectionId = f.sectionId;
  if (f.supplierId !== undefined) changes.supplierId = f.supplierId;
  if (f.includesTax !== undefined) changes.includesTax = f.includesTax;

  return changes;
}

export const productService = {
  async findByBarcode(db: DbClient, companyId: string, barcode: string) {
    return productRepository.findByBarcode(db, companyId, barcode);
  },

  async list(db: DbClient, companyId: string, filters: ListFilters = {}) {
    return productRepository.list(db, companyId, filters);
  },

  async create(db: DbClient, companyId: string, body: Record<string, unknown>) {
    const input = buildCreateInput(companyId, body);
    return productRepository.insert(db, input);
  },

  async bulkCreate(db: DbClient, companyId: string, products: unknown[]) {
    const categories = await productRepository.listCategories(db, companyId);
    const categoryByName = new Map(categories.map(c => [c.name.trim().toLowerCase(), c.id]));

    let created = 0;
    const skipped: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < products.length; i++) {
      const row = products[i] as Record<string, unknown>;
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
          const newCat = await productRepository.insertCategory(db, companyId, String(row.category).trim());
          categoryByName.set(key, newCat.id);
          categoryId = newCat.id;
        }
      }

      try {
        await productRepository.insert(db, {
          companyId,
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

    return { created, skipped };
  },

  async findById(db: DbClient, companyId: string, id: string) {
    return productRepository.findById(db, companyId, id);
  },

  async update(db: DbClient, companyId: string, id: string, body: Record<string, unknown>): Promise<{
    before: { costPrice: unknown; sellingPrice: unknown; stock: unknown } | undefined;
    updated: Record<string, unknown> | undefined;
  }> {
    const [before] = await db.select({
      costPrice: productsTable.costPrice,
      sellingPrice: productsTable.sellingPrice,
      stock: productsTable.stock,
    }).from(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.companyId, companyId)));

    const changes = buildUpdateChanges(body);
    const updated = await productRepository.update(db, companyId, id, changes);

    return { before, updated: updated ?? undefined };
  },

  async delete(db: DbClient, companyId: string, id: string) {
    return productRepository.delete(db, companyId, id);
  },

  // ─── Variants ─────────────────────────────────────────────────────

  async listVariants(db: DbClient, companyId: string, parentId: string) {
    return productRepository.listVariants(db, companyId, parentId);
  },

  // ─── Related products ─────────────────────────────────────────────

  async getRelated(db: DbClient, companyId: string, productId: string) {
    const links = await productRepository.listRelatedLinks(db, companyId, productId);
    if (links.length === 0) return [];
    return productRepository.findRelatedProducts(db, links.map(l => l.relatedProductId));
  },

  async addRelated(db: DbClient, companyId: string, productId: string, relatedProductId: string) {
    return productRepository.insertRelatedProduct(db, companyId, productId, relatedProductId);
  },

  async removeRelated(db: DbClient, companyId: string, productId: string, relatedProductId: string) {
    return productRepository.deleteRelatedProduct(db, companyId, productId, relatedProductId);
  },

  async setHasRelatedProducts(db: DbClient, companyId: string, productId: string, value: boolean) {
    return productRepository.setHasRelatedProducts(db, companyId, productId, value);
  },

  // ─── Units ────────────────────────────────────────────────────────

  async listUnits(db: DbClient, companyId: string, productId: string) {
    return productRepository.listProductUnits(db, companyId, productId);
  },

  async addUnit(db: DbClient, companyId: string, productId: string, data: { unitId: string; conversionFactor: string; isBaseUnit?: boolean; barcode?: string; sellingPrice?: string }) {
    return productRepository.insertProductUnit(db, companyId, productId, data);
  },

  async removeUnit(db: DbClient, companyId: string, unitAssignmentId: string) {
    return productRepository.deleteProductUnit(db, companyId, unitAssignmentId);
  },

  // ─── Batches ──────────────────────────────────────────────────────

  async listBatches(db: DbClient, companyId: string, productId: string) {
    return productRepository.listBatches(db, companyId, productId);
  },

  async addBatch(db: DbClient, companyId: string, productId: string, data: { batchNumber: string; quantity: number; expiryDate?: Date }) {
    return productRepository.insertBatch(db, companyId, productId, data);
  },

  // ─── Addon groups ─────────────────────────────────────────────────

  async listAddonGroups(db: DbClient, companyId: string, productId: string) {
    return productRepository.listAddonGroups(db, companyId, productId);
  },

  async createAddonGroup(db: DbClient, companyId: string, productId: string, data: {
    name: string; nameEn?: string; required?: boolean; minSelect?: number; maxSelect?: number;
    options: Array<{ name: string; nameEn?: string; priceDelta?: number }>;
  }) {
    const result = await productRepository.insertAddonGroup(db, companyId, productId, data);
    await productRepository.setHasAddons(db, companyId, productId, true);
    return result;
  },

  async updateAddonGroup(db: DbClient, companyId: string, productId: string, groupId: string, data: {
    name?: string; nameEn?: string | null; required?: boolean; minSelect?: number; maxSelect?: number;
  }) {
    const changes: Record<string, unknown> = { name: data.name };
    if (data.nameEn !== undefined) changes.nameEn = data.nameEn ?? null;
    if (data.required !== undefined) changes.required = !!data.required;
    if (data.minSelect !== undefined) changes.minSelect = parseRequiredNumber(data.minSelect, "minSelect");
    if (data.maxSelect !== undefined) changes.maxSelect = parseRequiredNumber(data.maxSelect, "maxSelect");
    return productRepository.updateAddonGroup(db, companyId, groupId, changes);
  },

  async deleteAddonGroup(db: DbClient, companyId: string, productId: string, groupId: string) {
    return productRepository.deleteAddonGroup(db, companyId, productId, groupId);
  },

  async addAddonOption(db: DbClient, companyId: string, groupId: string, data: { name: string; nameEn?: string; priceDelta?: number }) {
    return productRepository.insertAddonOption(db, groupId, {
      name: data.name,
      nameEn: data.nameEn,
      priceDelta: (parseOptionalNumber(data.priceDelta, "priceDelta") ?? 0).toString(),
    });
  },

  async updateAddonOption(db: DbClient, companyId: string, optionId: string, data: { name: string; nameEn?: string | null; priceDelta?: number }) {
    const changes: Record<string, unknown> = { name: data.name };
    if (data.nameEn !== undefined) changes.nameEn = data.nameEn ?? null;
    if (data.priceDelta !== undefined) changes.priceDelta = (parseOptionalNumber(data.priceDelta, "priceDelta") ?? 0).toString();
    return productRepository.updateAddonOption(db, optionId, changes);
  },

  async deleteAddonOption(db: DbClient, companyId: string, optionId: string) {
    return productRepository.deleteAddonOption(db, optionId);
  },

  async findAddonGroupById(db: DbClient, companyId: string, groupId: string) {
    return productRepository.findAddonGroupById(db, companyId, groupId);
  },

  async findAddonOptionById(db: DbClient, optionId: string) {
    return productRepository.findAddonOptionById(db, optionId);
  },
};

import { eq, and, ilike, lte, or, inArray, sql } from "drizzle-orm";
import {
  productsTable, categoriesTable, suppliersTable,
  productAddonGroupsTable, productAddonOptionsTable,
  productRelatedProductsTable, productUnitsTable, unitsTable,
  productBatchesTable,
} from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export const PRODUCT_SELECT = {
  id: productsTable.id,
  name: productsTable.name,
  nameEn: productsTable.nameEn,
  sku: productsTable.sku,
  barcode: productsTable.barcode,
  description: productsTable.description,
  costPrice: productsTable.costPrice,
  sellingPrice: productsTable.sellingPrice,
  minSellingPrice: productsTable.minSellingPrice,
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
  displayMode: productsTable.displayMode,
  hasAddons: productsTable.hasAddons,
  hasRelatedProducts: productsTable.hasRelatedProducts,
  parentProductId: productsTable.parentProductId,
  variantAttributes: productsTable.variantAttributes,
  createdAt: productsTable.createdAt,
};

export interface ListFilters {
  search?: string;
  categoryId?: string;
  lowStock?: boolean;
  limit?: number;
}

export interface CreateProductInput {
  companyId: string;
  name: string;
  nameEn?: string | null;
  sku: string;
  barcode?: string;
  description?: string;
  costPrice?: string;
  sellingPrice?: string;
  minSellingPrice?: string;
  stock?: number;
  lowStockThreshold?: number;
  categoryId?: string;
  brand?: string;
  imageUrl?: string;
  warehouseId?: string;
  sectionId?: string;
  supplierId?: string;
  includesTax?: boolean;
  parentProductId?: string;
  variantAttributes?: Record<string, string> | null;
}

export interface UpdateProductInput {
  name?: string;
  nameEn?: string | null;
  sku?: string;
  barcode?: string | null;
  description?: string;
  costPrice?: string;
  sellingPrice?: string;
  minSellingPrice?: string | null;
  stock?: number;
  lowStockThreshold?: number;
  categoryId?: string | null;
  brand?: string;
  imageUrl?: string;
  warehouseId?: string;
  sectionId?: string;
  supplierId?: string;
  includesTax?: boolean;
}

export const productRepository = {
  // ─── Core product CRUD ─────────────────────────────────────────────

  async findByBarcode(db: DbClient, companyId: string, barcode: string) {
    const [product] = await db.select(PRODUCT_SELECT).from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
      .where(and(eq(productsTable.barcode, barcode), eq(productsTable.companyId, companyId)));
    return product;
  },

  async list(db: DbClient, companyId: string, filters: ListFilters = {}) {
    const base = db.select(PRODUCT_SELECT).from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id));

    const conditions = [eq(productsTable.companyId, companyId)];
    if (filters.search) {
      conditions.push(or(
        ilike(productsTable.name, `%${filters.search}%`),
        ilike(productsTable.sku, `%${filters.search}%`),
        ilike(productsTable.barcode, `%${filters.search}%`),
      )!);
    }
    if (filters.categoryId) conditions.push(eq(productsTable.categoryId, filters.categoryId));
    if (filters.lowStock) conditions.push(lte(productsTable.stock, productsTable.lowStockThreshold));

    return base.$dynamic().where(and(...conditions)).orderBy(productsTable.name);
  },

  async findById(db: DbClient, companyId: string, id: string) {
    const [product] = await db.select(PRODUCT_SELECT).from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
      .where(and(eq(productsTable.id, id), eq(productsTable.companyId, companyId)));
    return product;
  },

  async findRawById(db: DbClient, companyId: string, id: string): Promise<typeof productsTable.$inferSelect | undefined> {
    const [product] = await db.select().from(productsTable)
      .where(and(eq(productsTable.id, id), eq(productsTable.companyId, companyId)));
    return product;
  },

  async insert(db: DbClient, input: CreateProductInput) {
    const [product] = await db.insert(productsTable).values({
      companyId: input.companyId,
      name: input.name,
      nameEn: input.nameEn,
      sku: input.sku,
      barcode: input.barcode || undefined,
      description: input.description,
      costPrice: input.costPrice ?? "0",
      sellingPrice: input.sellingPrice ?? "0",
      minSellingPrice: input.minSellingPrice !== undefined ? input.minSellingPrice : undefined,
      stock: input.stock ?? 0,
      lowStockThreshold: input.lowStockThreshold ?? 5,
      categoryId: input.categoryId,
      brand: input.brand,
      imageUrl: input.imageUrl,
      warehouseId: input.warehouseId,
      sectionId: input.sectionId,
      supplierId: input.supplierId,
      includesTax: input.includesTax ?? false,
      ...(input.parentProductId !== undefined ? { parentProductId: input.parentProductId } : {}),
      ...(input.variantAttributes !== undefined ? { variantAttributes: input.variantAttributes } : {}),
    }).returning();
    return product;
  },

  async update(db: DbClient, companyId: string, id: string, changes: Record<string, unknown>) {
    const [updated] = await db.update(productsTable).set(changes)
      .where(and(eq(productsTable.id, id), eq(productsTable.companyId, companyId)))
      .returning();
    return updated ?? undefined;
  },

  async delete(db: DbClient, companyId: string, id: string): Promise<void> {
    await db.delete(productsTable)
      .where(and(eq(productsTable.id, id), eq(productsTable.companyId, companyId)));
  },

  // ─── Variants ───────────────────────────────────────────────────────

  async listVariants(db: DbClient, companyId: string, parentId: string) {
    return db.select(PRODUCT_SELECT).from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
      .where(and(eq(productsTable.parentProductId, parentId), eq(productsTable.companyId, companyId)))
      .orderBy(productsTable.name);
  },

  // ─── Categories (for bulk import) ───────────────────────────────────

  async listCategories(db: DbClient, companyId: string) {
    return db.select().from(categoriesTable).where(eq(categoriesTable.companyId, companyId));
  },

  async insertCategory(db: DbClient, companyId: string, name: string) {
    const [cat] = await db.insert(categoriesTable).values({ companyId, name }).returning();
    return cat;
  },

  // ─── Related products ───────────────────────────────────────────────

  async listRelatedLinks(db: DbClient, companyId: string, productId: string) {
    return db.select().from(productRelatedProductsTable)
      .where(and(eq(productRelatedProductsTable.companyId, companyId), eq(productRelatedProductsTable.productId, productId)))
      .orderBy(productRelatedProductsTable.sortOrder);
  },

  async findRelatedProducts(db: DbClient, ids: string[]) {
    return db.select(PRODUCT_SELECT).from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
      .where(inArray(productsTable.id, ids));
  },

  async insertRelatedProduct(db: DbClient, companyId: string, productId: string, relatedProductId: string) {
    await db.insert(productRelatedProductsTable).values({ companyId, productId, relatedProductId });
  },

  async deleteRelatedProduct(db: DbClient, companyId: string, productId: string, relatedProductId: string) {
    await db.delete(productRelatedProductsTable).where(and(
      eq(productRelatedProductsTable.companyId, companyId),
      eq(productRelatedProductsTable.productId, productId),
      eq(productRelatedProductsTable.relatedProductId, relatedProductId),
    ));
  },

  async setHasRelatedProducts(db: DbClient, companyId: string, productId: string, value: boolean) {
    await db.update(productsTable).set({ hasRelatedProducts: value })
      .where(and(eq(productsTable.id, productId), eq(productsTable.companyId, companyId)));
  },

  // ─── Units ──────────────────────────────────────────────────────────

  async listProductUnits(db: DbClient, companyId: string, productId: string) {
    return db.select({
      id: productUnitsTable.id,
      unitId: productUnitsTable.unitId,
      unitName: unitsTable.nameAr,
      unitSymbol: unitsTable.symbol,
      conversionFactor: productUnitsTable.conversionFactor,
      isBaseUnit: productUnitsTable.isBaseUnit,
      barcode: productUnitsTable.barcode,
      sellingPrice: productUnitsTable.sellingPrice,
    }).from(productUnitsTable)
      .innerJoin(unitsTable, eq(productUnitsTable.unitId, unitsTable.id))
      .where(and(eq(productUnitsTable.companyId, companyId), eq(productUnitsTable.productId, productId)));
  },

  async insertProductUnit(db: DbClient, companyId: string, productId: string, data: { unitId: string; conversionFactor: string; isBaseUnit?: boolean; barcode?: string; sellingPrice?: string }) {
    const [row] = await db.insert(productUnitsTable).values({
      companyId, productId,
      unitId: data.unitId,
      conversionFactor: data.conversionFactor,
      isBaseUnit: data.isBaseUnit ?? false,
      barcode: data.barcode,
      sellingPrice: data.sellingPrice,
    }).returning();
    return row;
  },

  async deleteProductUnit(db: DbClient, companyId: string, unitAssignmentId: string) {
    await db.delete(productUnitsTable).where(and(
      eq(productUnitsTable.id, unitAssignmentId),
      eq(productUnitsTable.companyId, companyId),
    ));
  },

  // ─── Batches ────────────────────────────────────────────────────────

  async listBatches(db: DbClient, companyId: string, productId: string) {
    return db.select().from(productBatchesTable)
      .where(and(eq(productBatchesTable.companyId, companyId), eq(productBatchesTable.productId, productId)))
      .orderBy(productBatchesTable.expiryDate);
  },

  async insertBatch(db: DbClient, companyId: string, productId: string, data: { batchNumber: string; quantity: number; expiryDate?: Date }) {
    const [batch] = await db.insert(productBatchesTable).values({
      companyId, productId,
      batchNumber: data.batchNumber,
      quantity: data.quantity,
      expiryDate: data.expiryDate ?? null,
    }).returning();
    return batch;
  },

  // ─── Addon groups ──────────────────────────────────────────────────

  async listAddonGroups(db: DbClient, companyId: string, productId: string) {
    const groups = await db.select().from(productAddonGroupsTable)
      .where(and(eq(productAddonGroupsTable.companyId, companyId), eq(productAddonGroupsTable.productId, productId)))
      .orderBy(productAddonGroupsTable.sortOrder);
    if (groups.length === 0) return [];
    const options = await db.select().from(productAddonOptionsTable)
      .where(inArray(productAddonOptionsTable.groupId, groups.map(g => g.id)))
      .orderBy(productAddonOptionsTable.sortOrder);
    return groups.map(g => ({ ...g, options: options.filter(o => o.groupId === g.id) }));
  },

  async insertAddonGroup(db: DbClient, companyId: string, productId: string, data: {
    name: string; nameEn?: string; required?: boolean; minSelect?: number; maxSelect?: number;
    options: Array<{ name: string; nameEn?: string; priceDelta?: number }>;
  }) {
    const [group] = await db.insert(productAddonGroupsTable).values({
      companyId, productId,
      name: data.name,
      nameEn: data.nameEn,
      required: data.required ?? false,
      minSelect: data.minSelect ?? 0,
      maxSelect: data.maxSelect ?? 1,
    }).returning();
    const insertedOptions = await db.insert(productAddonOptionsTable).values(
      data.options.map(o => ({
        groupId: group.id,
        name: o.name,
        nameEn: o.nameEn,
        priceDelta: (o.priceDelta ?? 0).toString(),
      })),
    ).returning();
    return { ...group, options: insertedOptions };
  },

  async updateAddonGroup(db: DbClient, companyId: string, groupId: string, changes: Record<string, unknown>) {
    const [updated] = await db.update(productAddonGroupsTable).set(changes)
      .where(and(eq(productAddonGroupsTable.id, groupId), eq(productAddonGroupsTable.companyId, companyId)))
      .returning();
    return updated ?? undefined;
  },

  async findAddonGroupById(db: DbClient, companyId: string, groupId: string) {
    const [group] = await db.select().from(productAddonGroupsTable)
      .where(and(eq(productAddonGroupsTable.id, groupId), eq(productAddonGroupsTable.companyId, companyId)));
    return group;
  },

  async deleteAddonGroup(db: DbClient, companyId: string, productId: string, groupId: string) {
    await db.delete(productAddonOptionsTable).where(eq(productAddonOptionsTable.groupId, groupId));
    await db.delete(productAddonGroupsTable).where(and(
      eq(productAddonGroupsTable.id, groupId),
      eq(productAddonGroupsTable.companyId, companyId),
    ));
    const remaining = await db.select({ id: productAddonGroupsTable.id }).from(productAddonGroupsTable)
      .where(and(eq(productAddonGroupsTable.productId, productId), eq(productAddonGroupsTable.companyId, companyId)));
    if (remaining.length === 0) {
      await db.update(productsTable).set({ hasAddons: false })
        .where(and(eq(productsTable.id, productId), eq(productsTable.companyId, companyId)));
    }
  },

  async setHasAddons(db: DbClient, companyId: string, productId: string, value: boolean) {
    await db.update(productsTable).set({ hasAddons: value })
      .where(and(eq(productsTable.id, productId), eq(productsTable.companyId, companyId)));
  },

  async findAddonOptionById(db: DbClient, optionId: string) {
    const [option] = await db.select({
      id: productAddonOptionsTable.id,
      groupId: productAddonOptionsTable.groupId,
    }).from(productAddonOptionsTable).where(eq(productAddonOptionsTable.id, optionId));
    return option;
  },

  async insertAddonOption(db: DbClient, groupId: string, data: { name: string; nameEn?: string; priceDelta: string }) {
    const [option] = await db.insert(productAddonOptionsTable).values({
      groupId,
      name: data.name,
      nameEn: data.nameEn,
      priceDelta: data.priceDelta,
    }).returning();
    return option;
  },

  async updateAddonOption(db: DbClient, optionId: string, changes: Record<string, unknown>) {
    const [updated] = await db.update(productAddonOptionsTable).set(changes)
      .where(eq(productAddonOptionsTable.id, optionId)).returning();
    return updated ?? undefined;
  },

  async deleteAddonOption(db: DbClient, optionId: string) {
    await db.delete(productAddonOptionsTable).where(eq(productAddonOptionsTable.id, optionId));
  },
};

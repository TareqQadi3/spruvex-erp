import { eq, and, or, ilike, isNull } from "drizzle-orm";
import {
  db, productsTable, categoriesTable, unitsTable, productUnitsTable,
  customersTable, suppliersTable, importJobsTable,
} from "@workspace/db";
import { IMPORT_ENTITY_CONFIGS } from "./entityConfigs";
import { isUniqueViolation } from "../../lib/validation";

export type DuplicateStrategy = "skip" | "update" | "create_new";

export interface MappedRowResult {
  rowIndex: number;
  mapped: Record<string, string>;
  errors: string[];
  duplicate?: { matchedBy: string; existingId: string; existingLabel: string };
}

function applyMapping(rawRow: Record<string, unknown>, mapping: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [targetField, sourceColumn] of Object.entries(mapping)) {
    const value = rawRow[sourceColumn];
    if (value != null && value !== "") mapped[targetField] = String(value).trim();
  }
  return mapped;
}

async function findDuplicate(
  companyId: string,
  entityType: string,
  mapped: Record<string, string>,
): Promise<{ matchedBy: string; existingId: string; existingLabel: string } | undefined> {
  if (entityType === "products") {
    if (mapped.barcode) {
      const [row] = await db.select().from(productsTable).where(and(eq(productsTable.companyId, companyId), eq(productsTable.barcode, mapped.barcode))).limit(1);
      if (row) return { matchedBy: "barcode", existingId: row.id, existingLabel: row.name };
    }
    if (mapped.sku) {
      const [row] = await db.select().from(productsTable).where(and(eq(productsTable.companyId, companyId), eq(productsTable.sku, mapped.sku))).limit(1);
      if (row) return { matchedBy: "sku", existingId: row.id, existingLabel: row.name };
    }
    if (mapped.name) {
      const [row] = await db.select().from(productsTable).where(and(eq(productsTable.companyId, companyId), ilike(productsTable.name, mapped.name))).limit(1);
      if (row) return { matchedBy: "name", existingId: row.id, existingLabel: row.name };
    }
  } else if (entityType === "customers") {
    if (mapped.phone) {
      const [row] = await db.select().from(customersTable).where(and(eq(customersTable.companyId, companyId), eq(customersTable.phone, mapped.phone))).limit(1);
      if (row) return { matchedBy: "phone", existingId: row.id, existingLabel: row.name };
    }
    if (mapped.email) {
      const [row] = await db.select().from(customersTable).where(and(eq(customersTable.companyId, companyId), ilike(customersTable.email, mapped.email))).limit(1);
      if (row) return { matchedBy: "email", existingId: row.id, existingLabel: row.name };
    }
  } else if (entityType === "suppliers") {
    if (mapped.name) {
      const [row] = await db.select().from(suppliersTable).where(and(eq(suppliersTable.companyId, companyId), ilike(suppliersTable.name, mapped.name))).limit(1);
      if (row) return { matchedBy: "name", existingId: row.id, existingLabel: row.name };
    }
  }
  return undefined;
}

export async function validateRows(
  companyId: string,
  entityType: string,
  mapping: Record<string, string>,
  rawRows: Array<Record<string, unknown>>,
): Promise<MappedRowResult[]> {
  const config = IMPORT_ENTITY_CONFIGS[entityType];
  if (!config) throw new Error(`Unknown entity type: ${entityType}`);

  const seenInFile = new Set<string>(); // sku/barcode/phone seen earlier in this same file
  const results: MappedRowResult[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const mapped = applyMapping(rawRows[i], mapping);
    const errors: string[] = [];

    for (const field of config.fields) {
      if (field.required && !mapped[field.key]) {
        errors.push(`${field.label} مطلوب`);
      }
      if (field.type === "number" && mapped[field.key] !== undefined && isNaN(Number(mapped[field.key]))) {
        errors.push(`${field.label} يجب أن يكون رقم`);
      }
    }

    // In-file duplicate (two rows in the same upload with the same key)
    const fileKey = mapped.barcode || mapped.sku || mapped.phone || mapped.email;
    if (fileKey && seenInFile.has(fileKey)) {
      errors.push("مكرر داخل نفس الملف");
    }
    if (fileKey) seenInFile.add(fileKey);

    const duplicate = errors.length === 0 ? await findDuplicate(companyId, entityType, mapped) : undefined;

    results.push({ rowIndex: i, mapped, errors, duplicate });
  }

  return results;
}

async function resolveCategoryId(companyId: string, name: string | undefined): Promise<string | undefined> {
  if (!name) return undefined;
  const [existing] = await db.select().from(categoriesTable).where(and(eq(categoriesTable.companyId, companyId), ilike(categoriesTable.name, name))).limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(categoriesTable).values({ companyId, name }).returning();
  return created.id;
}

async function resolveUnitId(companyId: string, name: string | undefined): Promise<string | undefined> {
  if (!name) return undefined;
  const [existing] = await db.select().from(unitsTable).where(and(eq(unitsTable.companyId, companyId), ilike(unitsTable.nameAr, name))).limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(unitsTable).values({ companyId, nameAr: name }).returning();
  return created.id;
}

export interface ExecuteResult {
  created: number;
  updated: number;
  skipped: number;
  failed: Array<{ row: number; error: string }>;
}

export async function executeImport(
  companyId: string,
  userId: string,
  entityType: string,
  fileName: string | undefined,
  mapping: Record<string, string>,
  rawRows: Array<Record<string, unknown>>,
  duplicateStrategy: DuplicateStrategy,
): Promise<ExecuteResult> {
  const validated = await validateRows(companyId, entityType, mapping, rawRows);
  const result: ExecuteResult = { created: 0, updated: 0, skipped: 0, failed: [] };

  // Products: two passes so variant rows can reference a parent created
  // earlier in the same file (variantOfSku column).
  const skuToProductId = new Map<string, string>();
  const order = entityType === "products"
    ? [...validated.filter(r => !r.mapped.variantOfSku), ...validated.filter(r => r.mapped.variantOfSku)]
    : validated;

  for (const row of order) {
    if (row.errors.length > 0) {
      result.failed.push({ row: row.rowIndex + 1, error: row.errors.join("، ") });
      continue;
    }
    if (row.duplicate && duplicateStrategy === "skip") {
      result.skipped++;
      continue;
    }

    try {
      if (entityType === "products") {
        const { mapped } = row;
        const categoryId = await resolveCategoryId(companyId, mapped.category);
        let parentProductId: string | undefined;
        if (mapped.variantOfSku) {
          parentProductId = skuToProductId.get(mapped.variantOfSku);
          if (!parentProductId) {
            const [parent] = await db.select().from(productsTable).where(and(eq(productsTable.companyId, companyId), eq(productsTable.sku, mapped.variantOfSku))).limit(1);
            parentProductId = parent?.id;
          }
          if (!parentProductId) {
            result.failed.push({ row: row.rowIndex + 1, error: `لم يتم العثور على المنتج الأساسي (SKU: ${mapped.variantOfSku})` });
            continue;
          }
        }
        let variantAttributes: Record<string, string> | undefined;
        if (mapped.variantAttributes) {
          variantAttributes = {};
          for (const pair of mapped.variantAttributes.split(";")) {
            const [k, v] = pair.split(":").map(s => s?.trim());
            if (k && v) variantAttributes[k] = v;
          }
        }

        const values = {
          companyId,
          name: mapped.name,
          nameEn: mapped.nameEn,
          sku: mapped.sku,
          barcode: mapped.barcode || undefined,
          description: mapped.description,
          costPrice: mapped.costPrice ?? "0",
          sellingPrice: mapped.sellingPrice ?? "0",
          stock: mapped.stock ? Number(mapped.stock) : 0,
          lowStockThreshold: mapped.lowStockThreshold ? Number(mapped.lowStockThreshold) : 5,
          categoryId,
          brand: mapped.brand,
          parentProductId,
          variantAttributes,
        };

        if (row.duplicate && duplicateStrategy === "update") {
          await db.update(productsTable).set(values).where(eq(productsTable.id, row.duplicate.existingId));
          skuToProductId.set(mapped.sku, row.duplicate.existingId);
          result.updated++;
        } else {
          const [created] = await db.insert(productsTable).values(values).returning();
          skuToProductId.set(mapped.sku, created.id);
          result.created++;
        }

        if (mapped.unit && mapped.conversionFactor) {
          const unitId = await resolveUnitId(companyId, mapped.unit);
          const productId = skuToProductId.get(mapped.sku)!;
          if (unitId) {
            await db.insert(productUnitsTable).values({
              companyId, productId, unitId, conversionFactor: mapped.conversionFactor,
            }).onConflictDoNothing();
          }
        }
      } else if (entityType === "customers") {
        const { mapped } = row;
        const values = { companyId, name: mapped.name, phone: mapped.phone, email: mapped.email, address: mapped.address };
        if (row.duplicate && duplicateStrategy === "update") {
          await db.update(customersTable).set(values).where(eq(customersTable.id, row.duplicate.existingId));
          result.updated++;
        } else {
          await db.insert(customersTable).values(values);
          result.created++;
        }
      } else if (entityType === "suppliers") {
        const { mapped } = row;
        const values = { companyId, name: mapped.name, phone: mapped.phone, email: mapped.email, address: mapped.address, notes: mapped.notes };
        if (row.duplicate && duplicateStrategy === "update") {
          await db.update(suppliersTable).set(values).where(eq(suppliersTable.id, row.duplicate.existingId));
          result.updated++;
        } else {
          await db.insert(suppliersTable).values(values);
          result.created++;
        }
      }
    } catch (err) {
      if (isUniqueViolation(err)) {
        result.failed.push({ row: row.rowIndex + 1, error: "قيمة مكررة (SKU/Barcode) تعارضت أثناء الحفظ" });
      } else {
        result.failed.push({ row: row.rowIndex + 1, error: err instanceof Error ? err.message : "خطأ غير متوقع" });
      }
    }
  }

  await db.insert(importJobsTable).values({
    companyId, entityType, fileName,
    totalRows: rawRows.length,
    createdCount: result.created,
    updatedCount: result.updated,
    skippedCount: result.skipped,
    failedCount: result.failed.length,
    errors: result.failed.slice(0, 100),
    createdBy: userId,
  });

  return result;
}

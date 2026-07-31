import { Router } from "express";
import { db, PERMISSIONS } from "@workspace/db";
import { requirePermission, type AuthedRequest } from "../lib/auth-middleware";
import { ValidationError, isUniqueViolation } from "../lib/validation";
import { logAudit } from "../modules/auditLog/auditLogService";
import { productService, ProductValidationError } from "../modules/products/services/productService";
import { productRepository, PRODUCT_SELECT } from "../modules/products/repositories/productRepository";

const router = Router();

// Re-export PRODUCT_SELECT for backward compatibility (it was defined in this file and some
// importers may reference it from here, though realistically only this file and the
// repository use it).
export { PRODUCT_SELECT };

// ─── Barcode lookup ──────────────────────────────────────────────────

router.get("/barcode/:barcode", async (req: AuthedRequest, res) => {
  const product = await productRepository.findByBarcode(db, req.user!.companyId, String(req.params.barcode));
  if (!product) { res.status(404).json({ error: "Not found" }); return; }
  res.json(product);
});

// ─── List ────────────────────────────────────────────────────────────

router.get("/", async (req: AuthedRequest, res) => {
  const products = await productService.list(db, req.user!.companyId, {
    search: req.query.search as string | undefined,
    categoryId: req.query.categoryId as string | undefined,
    lowStock: req.query.lowStock === "true",
  });
  res.json(products);
});

// ─── Create ──────────────────────────────────────────────────────────

router.post("/", requirePermission(PERMISSIONS.PRODUCTS_CREATE), async (req: AuthedRequest, res) => {
  try {
    const product = await productService.create(db, req.user!.companyId, req.body);
    await logAudit({
      companyId: req.user!.companyId, userId: req.user!.id, action: "create_product",
      entityType: "product", entityId: product.id, newValue: { name: product.name, sku: product.sku, sellingPrice: product.sellingPrice },
    });
    res.status(201).json(product);
  } catch (err) {
    if (err instanceof ProductValidationError) { res.status(400).json({ error: err.message }); return; }
    if (err instanceof ValidationError) { res.status(400).json({ error: err.message }); return; }
    if (isUniqueViolation(err)) { res.status(409).json({ error: "A product with this SKU or barcode already exists" }); return; }
    throw err;
  }
});

// ─── Bulk create ─────────────────────────────────────────────────────

router.post("/bulk", async (req: AuthedRequest, res) => {
  const { products } = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    res.status(400).json({ error: "products array is required" });
    return;
  }
  const result = await productService.bulkCreate(db, req.user!.companyId, products);
  res.status(201).json(result);
});

// ─── Get by ID ───────────────────────────────────────────────────────

router.get("/:id", async (req: AuthedRequest, res) => {
  const product = await productRepository.findById(db, req.user!.companyId, req.params.id as string);
  if (!product) { res.status(404).json({ error: "Not found" }); return; }
  res.json(product);
});

// ─── Update ──────────────────────────────────────────────────────────

router.put("/:id", requirePermission(PERMISSIONS.PRODUCTS_UPDATE), async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  try {
    const { before, updated } = await productService.update(db, req.user!.companyId, id, req.body);
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const priceChanged = before && (before.costPrice !== updated.costPrice || before.sellingPrice !== updated.sellingPrice);
    const stockChanged = before && before.stock !== updated.stock;
    await logAudit({
      companyId: req.user!.companyId, userId: req.user!.id,
      action: priceChanged ? "edit_product_price" : stockChanged ? "edit_stock" : "update_product",
      entityType: "product", entityId: id,
      oldValue: before, newValue: { costPrice: updated.costPrice, sellingPrice: updated.sellingPrice, stock: updated.stock },
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof ValidationError) { res.status(400).json({ error: err.message }); return; }
    if (isUniqueViolation(err)) { res.status(409).json({ error: "A product with this SKU or barcode already exists" }); return; }
    throw err;
  }
});

// ─── Delete ──────────────────────────────────────────────────────────

router.delete("/:id", requirePermission(PERMISSIONS.PRODUCTS_DELETE), async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  await productService.delete(db, req.user!.companyId, id);
  await logAudit({ companyId: req.user!.companyId, userId: req.user!.id, action: "delete_product", entityType: "product", entityId: id });
  res.status(204).send();
});

// ─── Variants ────────────────────────────────────────────────────────

router.get("/:id/variants", async (req: AuthedRequest, res) => {
  const variants = await productService.listVariants(db, req.user!.companyId, req.params.id as string);
  res.json(variants);
});

// ─── Related products ────────────────────────────────────────────────

router.get("/:id/related", async (req: AuthedRequest, res) => {
  const related = await productService.getRelated(db, req.user!.companyId, req.params.id as string);
  res.json(related);
});

router.post("/:id/related", async (req: AuthedRequest, res) => {
  const productId = req.params.id as string;
  const { relatedProductId } = req.body;
  if (!relatedProductId) { res.status(400).json({ error: "relatedProductId is required" }); return; }
  if (relatedProductId === productId) { res.status(400).json({ error: "A product cannot be related to itself" }); return; }
  try {
    await productService.addRelated(db, req.user!.companyId, productId, relatedProductId);
  } catch (err) {
    if (isUniqueViolation(err)) { res.status(409).json({ error: "Already linked" }); return; }
    throw err;
  }
  await productService.setHasRelatedProducts(db, req.user!.companyId, productId, true);
  res.status(201).json({ linked: true });
});

router.delete("/:id/related/:relatedProductId", async (req: AuthedRequest, res) => {
  await productService.removeRelated(db, req.user!.companyId, req.params.id as string, req.params.relatedProductId as string);
  res.status(204).send();
});

// ─── Units ───────────────────────────────────────────────────────────

router.get("/:id/units", async (req: AuthedRequest, res) => {
  const rows = await productService.listUnits(db, req.user!.companyId, req.params.id as string);
  res.json(rows);
});

router.post("/:id/units", async (req: AuthedRequest, res) => {
  const { unitId, conversionFactor, isBaseUnit, barcode, sellingPrice } = req.body;
  if (!unitId || !conversionFactor) { res.status(400).json({ error: "unitId and conversionFactor are required" }); return; }
  const row = await productService.addUnit(db, req.user!.companyId, req.params.id as string, {
    unitId, conversionFactor: String(conversionFactor), isBaseUnit, barcode, sellingPrice: sellingPrice != null ? String(sellingPrice) : undefined,
  });
  res.status(201).json(row);
});

router.delete("/:id/units/:unitAssignmentId", async (req: AuthedRequest, res) => {
  await productService.removeUnit(db, req.user!.companyId, req.params.unitAssignmentId as string);
  res.status(204).send();
});

// ─── Batches ─────────────────────────────────────────────────────────

router.get("/:id/batches", async (req: AuthedRequest, res) => {
  const batches = await productService.listBatches(db, req.user!.companyId, req.params.id as string);
  res.json(batches);
});

router.post("/:id/batches", async (req: AuthedRequest, res) => {
  const { batchNumber, quantity, expiryDate } = req.body;
  if (!batchNumber || quantity == null) { res.status(400).json({ error: "batchNumber and quantity are required" }); return; }
  const batch = await productService.addBatch(db, req.user!.companyId, req.params.id as string, {
    batchNumber, quantity: Number(quantity), expiryDate: expiryDate ? new Date(expiryDate) : undefined,
  });
  res.status(201).json(batch);
});

// ─── Addon groups ────────────────────────────────────────────────────

router.get("/:id/addon-groups", async (req: AuthedRequest, res) => {
  const groups = await productService.listAddonGroups(db, req.user!.companyId, req.params.id as string);
  res.json(groups);
});

router.post("/:id/addon-groups", async (req: AuthedRequest, res) => {
  const { name, nameEn, required, minSelect, maxSelect, options } = req.body;
  if (!name || !Array.isArray(options) || options.length === 0) {
    res.status(400).json({ error: "name and at least one option are required" });
    return;
  }
  const result = await productService.createAddonGroup(db, req.user!.companyId, req.params.id as string, {
    name, nameEn, required, minSelect, maxSelect,
    options: options.map((o: { name: string; nameEn?: string; priceDelta?: number }) => ({
      name: o.name, nameEn: o.nameEn, priceDelta: o.priceDelta,
    })),
  });
  res.status(201).json(result);
});

router.put("/:id/addon-groups/:groupId", async (req: AuthedRequest, res) => {
  const { name, nameEn, required, minSelect, maxSelect } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const updated = await productService.updateAddonGroup(db, req.user!.companyId, req.params.id as string, req.params.groupId as string, {
    name, nameEn, required, minSelect, maxSelect,
  });
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/:id/addon-groups/:groupId", async (req: AuthedRequest, res) => {
  const group = await productService.findAddonGroupById(db, req.user!.companyId, req.params.groupId as string);
  if (!group) { res.status(404).json({ error: "Not found" }); return; }
  await productService.deleteAddonGroup(db, req.user!.companyId, req.params.id as string, req.params.groupId as string);
  res.status(204).send();
});

router.post("/:id/addon-groups/:groupId/options", async (req: AuthedRequest, res) => {
  const { name, nameEn, priceDelta } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const group = await productService.findAddonGroupById(db, req.user!.companyId, req.params.groupId as string);
  if (!group) { res.status(404).json({ error: "Not found" }); return; }
  const option = await productService.addAddonOption(db, req.user!.companyId, req.params.groupId as string, { name, nameEn, priceDelta });
  res.status(201).json(option);
});

router.put("/:id/addon-groups/:groupId/options/:optionId", async (req: AuthedRequest, res) => {
  const { name, nameEn, priceDelta } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const option = await productService.findAddonOptionById(db, req.params.optionId as string);
  if (!option) { res.status(404).json({ error: "Not found" }); return; }
  const group = await productService.findAddonGroupById(db, req.user!.companyId, option.groupId);
  if (!group) { res.status(404).json({ error: "Not found" }); return; }
  const updated = await productService.updateAddonOption(db, req.user!.companyId, req.params.optionId as string, { name, nameEn, priceDelta });
  res.json(updated);
});

router.delete("/:id/addon-groups/:groupId/options/:optionId", async (req: AuthedRequest, res) => {
  const option = await productService.findAddonOptionById(db, req.params.optionId as string);
  if (!option) { res.status(404).json({ error: "Not found" }); return; }
  const group = await productService.findAddonGroupById(db, req.user!.companyId, option.groupId);
  if (!group) { res.status(404).json({ error: "Not found" }); return; }
  await productService.deleteAddonOption(db, req.user!.companyId, req.params.optionId as string);
  res.status(204).send();
});

export default router;

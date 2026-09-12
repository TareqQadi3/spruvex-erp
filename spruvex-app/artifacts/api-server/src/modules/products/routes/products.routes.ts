import { Router, type IRouter } from "express";
import { db, PERMISSIONS } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import { ValidationError, isUniqueViolation } from "../../../lib/validation";
import { logAudit } from "../../auditLog/auditLogService";
import { productService, ProductValidationError } from "../services/productService";
import { productRepository, PRODUCT_SELECT } from "../repositories/productRepository";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

// Re-export PRODUCT_SELECT for backward compatibility (it was defined in this file and some
// importers may reference it from here, though realistically only this file and the
// repository use it).
export { PRODUCT_SELECT };

// ─── Barcode lookup ──────────────────────────────────────────────────

router.get("/barcode/:barcode", async (req, res) => {
  const product = await productRepository.findByBarcode(db, req.tenant!.companyId, String(req.params.barcode));
  if (!product) { res.status(404).json({ error: "Not found" }); return; }
  res.json(product);
});

// ─── List ────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const products = await productService.list(db, req.tenant!.companyId, {
    search: req.query.search as string | undefined,
    categoryId: req.query.categoryId as string | undefined,
    lowStock: req.query.lowStock === "true",
  });
  res.json(products);
});

// ─── Create ──────────────────────────────────────────────────────────

router.post("/", requirePermission(PERMISSIONS.PRODUCTS_CREATE), async (req, res) => {
  try {
    const product = await productService.create(db, req.tenant!.companyId, req.body);
    await logAudit({
      companyId: req.tenant!.companyId, userId: req.tenant!.userId, action: "create_product",
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

router.post("/bulk", async (req, res) => {
  const { products } = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    res.status(400).json({ error: "products array is required" });
    return;
  }
  const result = await productService.bulkCreate(db, req.tenant!.companyId, products);
  res.status(201).json(result);
});

// ─── Get by ID ───────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  const product = await productRepository.findById(db, req.tenant!.companyId, req.params.id as string);
  if (!product) { res.status(404).json({ error: "Not found" }); return; }
  res.json(product);
});

// ─── Update ──────────────────────────────────────────────────────────

router.put("/:id", requirePermission(PERMISSIONS.PRODUCTS_UPDATE), async (req, res) => {
  const id = req.params.id as string;
  try {
    const { before, updated } = await productService.update(db, req.tenant!.companyId, id, req.body);
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const priceChanged = before && (before.costPrice !== updated.costPrice || before.sellingPrice !== updated.sellingPrice);
    const stockChanged = before && before.stock !== updated.stock;
    await logAudit({
      companyId: req.tenant!.companyId, userId: req.tenant!.userId,
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

router.delete("/:id", requirePermission(PERMISSIONS.PRODUCTS_DELETE), async (req, res) => {
  const id = req.params.id as string;
  await productService.delete(db, req.tenant!.companyId, id);
  await logAudit({ companyId: req.tenant!.companyId, userId: req.tenant!.userId, action: "delete_product", entityType: "product", entityId: id });
  res.status(204).send();
});

// ─── Variants ────────────────────────────────────────────────────────

router.get("/:id/variants", async (req, res) => {
  const variants = await productService.listVariants(db, req.tenant!.companyId, req.params.id as string);
  res.json(variants);
});

// ─── Related products ────────────────────────────────────────────────

router.get("/:id/related", async (req, res) => {
  const related = await productService.getRelated(db, req.tenant!.companyId, req.params.id as string);
  res.json(related);
});

router.post("/:id/related", async (req, res) => {
  const productId = req.params.id as string;
  const { relatedProductId } = req.body;
  if (!relatedProductId) { res.status(400).json({ error: "relatedProductId is required" }); return; }
  if (relatedProductId === productId) { res.status(400).json({ error: "A product cannot be related to itself" }); return; }
  try {
    await productService.addRelated(db, req.tenant!.companyId, productId, relatedProductId);
  } catch (err) {
    if (isUniqueViolation(err)) { res.status(409).json({ error: "Already linked" }); return; }
    throw err;
  }
  await productService.setHasRelatedProducts(db, req.tenant!.companyId, productId, true);
  res.status(201).json({ linked: true });
});

router.delete("/:id/related/:relatedProductId", async (req, res) => {
  await productService.removeRelated(db, req.tenant!.companyId, req.params.id as string, req.params.relatedProductId as string);
  res.status(204).send();
});

// ─── Units ───────────────────────────────────────────────────────────

router.get("/:id/units", async (req, res) => {
  const rows = await productService.listUnits(db, req.tenant!.companyId, req.params.id as string);
  res.json(rows);
});

router.post("/:id/units", async (req, res) => {
  const { unitId, conversionFactor, isBaseUnit, barcode, sellingPrice } = req.body;
  if (!unitId || !conversionFactor) { res.status(400).json({ error: "unitId and conversionFactor are required" }); return; }
  const row = await productService.addUnit(db, req.tenant!.companyId, req.params.id as string, {
    unitId, conversionFactor: String(conversionFactor), isBaseUnit, barcode, sellingPrice: sellingPrice != null ? String(sellingPrice) : undefined,
  });
  res.status(201).json(row);
});

router.delete("/:id/units/:unitAssignmentId", async (req, res) => {
  await productService.removeUnit(db, req.tenant!.companyId, req.params.unitAssignmentId as string);
  res.status(204).send();
});

// ─── Batches ─────────────────────────────────────────────────────────

router.get("/:id/batches", async (req, res) => {
  const batches = await productService.listBatches(db, req.tenant!.companyId, req.params.id as string);
  res.json(batches);
});

router.post("/:id/batches", async (req, res) => {
  const { batchNumber, quantity, expiryDate } = req.body;
  if (!batchNumber || quantity == null) { res.status(400).json({ error: "batchNumber and quantity are required" }); return; }
  const batch = await productService.addBatch(db, req.tenant!.companyId, req.params.id as string, {
    batchNumber, quantity: Number(quantity), expiryDate: expiryDate ? new Date(expiryDate) : undefined,
  });
  res.status(201).json(batch);
});

// ─── Image gallery ───────────────────────────────────────────────────

router.get("/:id/images", async (req, res) => {
  const images = await productService.listImages(db, req.tenant!.companyId, req.params.id as string);
  res.json(images);
});

router.post("/:id/images", async (req, res) => {
  const { url, isPrimary } = req.body;
  if (!url) { res.status(400).json({ error: "url is required" }); return; }
  const image = await productService.addImage(db, req.tenant!.companyId, req.params.id as string, { url, isPrimary });
  res.status(201).json(image);
});

router.put("/:id/images/:imageId", async (req, res) => {
  const { sortOrder, isPrimary } = req.body;
  const changes: { sortOrder?: number; isPrimary?: boolean } = {};
  if (sortOrder !== undefined) changes.sortOrder = Number(sortOrder);
  if (isPrimary !== undefined) changes.isPrimary = Boolean(isPrimary);
  const image = await productService.updateImage(db, req.tenant!.companyId, req.params.id as string, req.params.imageId as string, changes);
  if (!image) { res.status(404).json({ error: "Not found" }); return; }
  res.json(image);
});

router.delete("/:id/images/:imageId", async (req, res) => {
  await productService.removeImage(db, req.tenant!.companyId, req.params.imageId as string);
  res.status(204).send();
});

// ─── Addon groups ────────────────────────────────────────────────────

router.get("/:id/addon-groups", async (req, res) => {
  const groups = await productService.listAddonGroups(db, req.tenant!.companyId, req.params.id as string);
  res.json(groups);
});

router.post("/:id/addon-groups", async (req, res) => {
  const { name, nameEn, required, minSelect, maxSelect, options } = req.body;
  if (!name || !Array.isArray(options) || options.length === 0) {
    res.status(400).json({ error: "name and at least one option are required" });
    return;
  }
  const result = await productService.createAddonGroup(db, req.tenant!.companyId, req.params.id as string, {
    name, nameEn, required, minSelect, maxSelect,
    options: options.map((o: { name: string; nameEn?: string; priceDelta?: number }) => ({
      name: o.name, nameEn: o.nameEn, priceDelta: o.priceDelta,
    })),
  });
  res.status(201).json(result);
});

router.put("/:id/addon-groups/:groupId", async (req, res) => {
  const { name, nameEn, required, minSelect, maxSelect } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const updated = await productService.updateAddonGroup(db, req.tenant!.companyId, req.params.id as string, req.params.groupId as string, {
    name, nameEn, required, minSelect, maxSelect,
  });
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/:id/addon-groups/:groupId", async (req, res) => {
  const group = await productService.findAddonGroupById(db, req.tenant!.companyId, req.params.groupId as string);
  if (!group) { res.status(404).json({ error: "Not found" }); return; }
  await productService.deleteAddonGroup(db, req.tenant!.companyId, req.params.id as string, req.params.groupId as string);
  res.status(204).send();
});

router.post("/:id/addon-groups/:groupId/options", async (req, res) => {
  const { name, nameEn, priceDelta } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const group = await productService.findAddonGroupById(db, req.tenant!.companyId, req.params.groupId as string);
  if (!group) { res.status(404).json({ error: "Not found" }); return; }
  const option = await productService.addAddonOption(db, req.tenant!.companyId, req.params.groupId as string, { name, nameEn, priceDelta });
  res.status(201).json(option);
});

router.put("/:id/addon-groups/:groupId/options/:optionId", async (req, res) => {
  const { name, nameEn, priceDelta } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const option = await productService.findAddonOptionById(db, req.params.optionId as string);
  if (!option) { res.status(404).json({ error: "Not found" }); return; }
  const group = await productService.findAddonGroupById(db, req.tenant!.companyId, option.groupId);
  if (!group) { res.status(404).json({ error: "Not found" }); return; }
  const updated = await productService.updateAddonOption(db, req.tenant!.companyId, req.params.optionId as string, { name, nameEn, priceDelta });
  res.json(updated);
});

router.delete("/:id/addon-groups/:groupId/options/:optionId", async (req, res) => {
  const option = await productService.findAddonOptionById(db, req.params.optionId as string);
  if (!option) { res.status(404).json({ error: "Not found" }); return; }
  const group = await productService.findAddonGroupById(db, req.tenant!.companyId, option.groupId);
  if (!group) { res.status(404).json({ error: "Not found" }); return; }
  await productService.deleteAddonOption(db, req.tenant!.companyId, req.params.optionId as string);
  res.status(204).send();
});

export default router;

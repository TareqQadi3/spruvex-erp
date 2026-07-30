import { Router } from "express";
import {
  db, productsTable, customersTable, suppliersTable, salesTable,
  stockMovementsTable, categoriesTable, warehousesTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";
import { logAudit } from "../modules/auditLog/auditLogService";

const router = Router();

// Every endpoint just returns a plain JSON array — pos-system's export page
// turns that into an .xlsx file client-side (same `xlsx` package the import
// flow uses to parse uploads), so the server never generates or streams a
// binary file. One audit entry per export call, entityType taken from the
// matched route path (e.g. "/products" -> "products").
router.use((req: AuthedRequest, _res, next) => {
  logAudit({ companyId: req.user!.companyId, userId: req.user!.id, action: "export", entityType: req.path.replace(/^\//, "") || "unknown" });
  next();
});

router.get("/products", async (req: AuthedRequest, res) => {
  const rows = await db.select({
    name: productsTable.name, nameEn: productsTable.nameEn, sku: productsTable.sku,
    barcode: productsTable.barcode, costPrice: productsTable.costPrice, sellingPrice: productsTable.sellingPrice,
    stock: productsTable.stock, lowStockThreshold: productsTable.lowStockThreshold,
    category: categoriesTable.name, brand: productsTable.brand,
  }).from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.companyId, req.user!.companyId));
  res.json(rows);
});

router.get("/customers", async (req: AuthedRequest, res) => {
  const rows = await db.select({
    name: customersTable.name, phone: customersTable.phone, email: customersTable.email,
    address: customersTable.address, outstandingBalance: customersTable.outstandingBalance,
  }).from(customersTable).where(eq(customersTable.companyId, req.user!.companyId));
  res.json(rows);
});

router.get("/suppliers", async (req: AuthedRequest, res) => {
  const rows = await db.select({
    name: suppliersTable.name, phone: suppliersTable.phone, email: suppliersTable.email,
    address: suppliersTable.address, outstandingBalance: suppliersTable.outstandingBalance,
  }).from(suppliersTable).where(eq(suppliersTable.companyId, req.user!.companyId));
  res.json(rows);
});

router.get("/sales", async (req: AuthedRequest, res) => {
  const rows = await db.select({
    id: salesTable.id, total: salesTable.total, paymentMethod: salesTable.paymentMethod,
    status: salesTable.status, createdAt: salesTable.createdAt,
  }).from(salesTable).where(eq(salesTable.companyId, req.user!.companyId)).orderBy(desc(salesTable.createdAt)).limit(5000);
  res.json(rows);
});

router.get("/stock-movements", async (req: AuthedRequest, res) => {
  const rows = await db.select({
    productName: productsTable.name, warehouseName: warehousesTable.name,
    movementType: stockMovementsTable.movementType, quantity: stockMovementsTable.quantity,
    referenceType: stockMovementsTable.referenceType, createdAt: stockMovementsTable.createdAt,
  }).from(stockMovementsTable)
    .innerJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
    .innerJoin(warehousesTable, eq(stockMovementsTable.warehouseId, warehousesTable.id))
    .where(eq(stockMovementsTable.companyId, req.user!.companyId))
    .orderBy(desc(stockMovementsTable.createdAt)).limit(5000);
  res.json(rows);
});

export default router;

import { count, eq } from "drizzle-orm";
import {
  companiesTable,
  productsTable,
  purchaseInvoicesTable,
  purchaseReturnsTable,
  purchasesTable,
  settingsTable,
  suppliersTable,
  type InsertPurchaseInvoice,
  type PurchaseDocumentSource,
  type PurchaseInvoice,
} from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { compositeKeyMatch, withTenantScope } from "../../../core/database/compositeKey";

export interface PurchaseWithSupplier {
  id: string;
  companyId: string;
  productId: string;
  supplierId: string;
  quantity: number;
  returnedQuantity: number;
  totalCost: string;
  amountPaid: string;
  createdAt: Date;
  supplierName: string;
}

export interface PurchaseReturnWithPurchase {
  id: string;
  companyId: string;
  purchaseId: string;
  returnNumber: string;
  reason: string | null;
  quantity: number;
  unitCost: string;
  totalAmount: string;
  createdAt: Date;
  productId: string;
  supplierId: string;
  supplierName: string;
}

export class PurchaseInvoiceRepository {
  // Locks the tenant's companies row for the duration of the transaction,
  // serializing purchase-document-number generation per company — same
  // technique as modules/zatca's InvoiceRepository.lockCompanyForNumbering.
  async lockCompanyForNumbering(companyId: string, client: DbOrTx = db): Promise<void> {
    await client.select({ id: companiesTable.id }).from(companiesTable).where(eq(companiesTable.id, companyId)).for("update");
  }

  // Independent numbering sequence per sourceType (PINV- for purchases,
  // PDN- for purchase returns / debit notes).
  async countForCompany(companyId: string, sourceType: PurchaseDocumentSource, client: DbOrTx = db): Promise<number> {
    const [row] = await client
      .select({ n: count() })
      .from(purchaseInvoicesTable)
      .where(withTenantScope(purchaseInvoicesTable.companyId, companyId, eq(purchaseInvoicesTable.sourceType, sourceType)));
    return row?.n ?? 0;
  }

  async findExisting(
    companyId: string,
    sourceType: PurchaseDocumentSource,
    sourceId: string,
    client: DbOrTx = db,
  ): Promise<PurchaseInvoice | null> {
    const [row] = await client
      .select()
      .from(purchaseInvoicesTable)
      .where(
        withTenantScope(
          purchaseInvoicesTable.companyId,
          companyId,
          eq(purchaseInvoicesTable.sourceType, sourceType),
          eq(purchaseInvoicesTable.sourceId, sourceId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findPurchaseById(companyId: string, purchaseId: string, client: DbOrTx = db): Promise<PurchaseWithSupplier | null> {
    const [row] = await client
      .select({
        id: purchasesTable.id,
        companyId: purchasesTable.companyId,
        productId: purchasesTable.productId,
        supplierId: purchasesTable.supplierId,
        quantity: purchasesTable.quantity,
        returnedQuantity: purchasesTable.returnedQuantity,
        totalCost: purchasesTable.totalCost,
        amountPaid: purchasesTable.amountPaid,
        createdAt: purchasesTable.createdAt,
        supplierName: suppliersTable.name,
      })
      .from(purchasesTable)
      .leftJoin(suppliersTable, eq(suppliersTable.id, purchasesTable.supplierId))
      .where(compositeKeyMatch(purchasesTable.companyId, purchasesTable.id, companyId, purchaseId))
      .limit(1);
    if (!row) return null;
    return { ...row, supplierName: row.supplierName ?? "Supplier" };
  }

  async findPurchaseReturnById(
    companyId: string,
    returnId: string,
    client: DbOrTx = db,
  ): Promise<PurchaseReturnWithPurchase | null> {
    const [row] = await client
      .select({
        id: purchaseReturnsTable.id,
        companyId: purchaseReturnsTable.companyId,
        purchaseId: purchaseReturnsTable.purchaseId,
        returnNumber: purchaseReturnsTable.returnNumber,
        reason: purchaseReturnsTable.reason,
        quantity: purchaseReturnsTable.quantity,
        unitCost: purchaseReturnsTable.unitCost,
        totalAmount: purchaseReturnsTable.totalAmount,
        createdAt: purchaseReturnsTable.createdAt,
        productId: purchasesTable.productId,
        supplierId: purchasesTable.supplierId,
        supplierName: suppliersTable.name,
      })
      .from(purchaseReturnsTable)
      .leftJoin(purchasesTable, eq(purchasesTable.id, purchaseReturnsTable.purchaseId))
      .leftJoin(suppliersTable, eq(suppliersTable.id, purchasesTable.supplierId))
      .where(compositeKeyMatch(purchaseReturnsTable.companyId, purchaseReturnsTable.id, companyId, returnId))
      .limit(1);
    if (!row || !row.productId || !row.supplierId) return null;
    return {
      ...row,
      productId: row.productId,
      supplierId: row.supplierId,
      supplierName: row.supplierName ?? "Supplier",
    };
  }

  async findSettings(companyId: string, client: DbOrTx = db) {
    const [settings] = await client.select().from(settingsTable).where(eq(settingsTable.companyId, companyId)).limit(1);
    return settings ?? null;
  }

  async findProductById(companyId: string, productId: string, client: DbOrTx = db) {
    const [product] = await client
      .select()
      .from(productsTable)
      .where(compositeKeyMatch(productsTable.companyId, productsTable.id, companyId, productId))
      .limit(1);
    return product ?? null;
  }

  async create(input: InsertPurchaseInvoice, client: DbOrTx = db): Promise<PurchaseInvoice> {
    const [row] = await client.insert(purchaseInvoicesTable).values(input).returning();
    return row;
  }

  async findById(companyId: string, id: string, client: DbOrTx = db): Promise<PurchaseInvoice | null> {
    const [row] = await client
      .select()
      .from(purchaseInvoicesTable)
      .where(compositeKeyMatch(purchaseInvoicesTable.companyId, purchaseInvoicesTable.id, companyId, id))
      .limit(1);
    return row ?? null;
  }
}

export const purchaseInvoiceRepository = new PurchaseInvoiceRepository();

import { and, count, desc, eq, lt, sql } from "drizzle-orm";
import {
  companiesTable,
  invoiceXmlTable,
  invoicesTable,
  productsTable,
  qrCodesTable,
  saleItemsTable,
  saleReturnItemsTable,
  saleReturnsTable,
  salesTable,
  settingsTable,
  signaturesTable,
} from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { compositeKeyMatch, withTenantScope } from "../../../core/database/compositeKey";

export class InvoiceRepository {
  // Locks the tenant's companies row for the duration of the transaction,
  // serializing invoice-number generation per company (different companies
  // aren't blocked) without needing a dedicated sequence table.
  async lockCompanyForNumbering(companyId: string, client: DbOrTx = db): Promise<void> {
    await client.select({ id: companiesTable.id }).from(companiesTable).where(eq(companiesTable.id, companyId)).for("update");
  }

  // Worker-only: scans across every tenant for invoices stuck mid-submission
  // (status = 'submitted' without ever reaching accepted/rejected). With the
  // current submitToZATCA implementation this is unreachable — one atomic
  // transaction means any failure rolls all the way back to "signed", never
  // stranding an invoice at "submitted" (see zatcaService's header comment).
  // Kept anyway: a real ZATCA integration's clearance/reporting call can
  // genuinely be async or fail after only partially completing, and this is
  // the correct signal to detect that once the stub is replaced.
  async findInvoicesStuckSubmitted(olderThanMs: number, client: DbOrTx = db) {
    const cutoff = new Date(Date.now() - olderThanMs);
    return client
      .select()
      .from(invoicesTable)
      .where(and(eq(invoicesTable.status, "submitted"), lt(invoicesTable.updatedAt, cutoff)));
  }

  async countForCompany(companyId: string, client: DbOrTx = db): Promise<number> {
    const [row] = await client.select({ n: count() }).from(invoicesTable).where(eq(invoicesTable.companyId, companyId));
    return row?.n ?? 0;
  }

  async findCompanyById(companyId: string, client: DbOrTx = db) {
    const [company] = await client.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
    return company ?? null;
  }

  async findSettings(companyId: string, client: DbOrTx = db) {
    const [settings] = await client.select().from(settingsTable).where(eq(settingsTable.companyId, companyId)).limit(1);
    return settings ?? null;
  }

  async findSaleById(companyId: string, saleId: string, client: DbOrTx = db) {
    const [sale] = await client
      .select()
      .from(salesTable)
      .where(compositeKeyMatch(salesTable.companyId, salesTable.id, companyId, saleId))
      .limit(1);
    return sale ?? null;
  }

  async findSaleItems(companyId: string, saleId: string, client: DbOrTx = db) {
    return client
      .select()
      .from(saleItemsTable)
      .where(withTenantScope(saleItemsTable.companyId, companyId, eq(saleItemsTable.saleId, saleId)));
  }

  async findBySaleId(companyId: string, saleId: string, client: DbOrTx = db) {
    const [invoice] = await client
      .select()
      .from(invoicesTable)
      .where(withTenantScope(invoicesTable.companyId, companyId, eq(invoicesTable.saleId, saleId)))
      .limit(1);
    return invoice ?? null;
  }

  async findBySaleReturnId(companyId: string, saleReturnId: string, client: DbOrTx = db) {
    const [invoice] = await client
      .select()
      .from(invoicesTable)
      .where(withTenantScope(invoicesTable.companyId, companyId, eq(invoicesTable.saleReturnId, saleReturnId)))
      .limit(1);
    return invoice ?? null;
  }

  async findSaleReturnById(companyId: string, saleReturnId: string, client: DbOrTx = db) {
    const [saleReturn] = await client
      .select()
      .from(saleReturnsTable)
      .where(compositeKeyMatch(saleReturnsTable.companyId, saleReturnsTable.id, companyId, saleReturnId))
      .limit(1);
    return saleReturn ?? null;
  }

  // Return-item lines with product names joined in (sale_return_items has no
  // productName column of its own — see lib/db/src/schema/sales.ts). A left
  // join means a deleted/missing product row doesn't blow up XML/print
  // generation for an otherwise-valid return; it just falls back to "Product".
  // Returns both returned and exchanged-in rows (isExchange included) —
  // callers building ZATCA output must filter out isExchange: true themselves,
  // since a credit note reverses only the returned units, not replacement stock.
  async findSaleReturnItems(companyId: string, saleReturnId: string, client: DbOrTx = db) {
    return client
      .select({
        productId: saleReturnItemsTable.productId,
        productName: sql<string>`coalesce(${productsTable.name}, 'Product')`,
        quantity: saleReturnItemsTable.quantity,
        unitPrice: saleReturnItemsTable.unitPrice,
        subtotal: saleReturnItemsTable.subtotal,
        isExchange: saleReturnItemsTable.isExchange,
      })
      .from(saleReturnItemsTable)
      .leftJoin(productsTable, eq(productsTable.id, saleReturnItemsTable.productId))
      .where(withTenantScope(saleReturnItemsTable.companyId, companyId, eq(saleReturnItemsTable.saleReturnId, saleReturnId)));
  }

  async findById(companyId: string, invoiceId: string, client: DbOrTx = db) {
    const [invoice] = await client
      .select()
      .from(invoicesTable)
      .where(compositeKeyMatch(invoicesTable.companyId, invoicesTable.id, companyId, invoiceId))
      .limit(1);
    return invoice ?? null;
  }

  async findByIdForUpdate(companyId: string, invoiceId: string, client: DbOrTx = db) {
    const [invoice] = await client
      .select()
      .from(invoicesTable)
      .where(compositeKeyMatch(invoicesTable.companyId, invoicesTable.id, companyId, invoiceId))
      .for("update");
    return invoice ?? null;
  }

  // Most recently signed invoice for this company — the tail of the hash
  // chain that the next signature must link to.
  async findLastSignature(companyId: string, client: DbOrTx = db) {
    const [row] = await client
      .select({ invoiceHash: signaturesTable.invoiceHash })
      .from(signaturesTable)
      .where(eq(signaturesTable.companyId, companyId))
      .orderBy(desc(signaturesTable.signedAt))
      .limit(1);
    return row ?? null;
  }

  async create(input: typeof invoicesTable.$inferInsert, client: DbOrTx = db) {
    const [invoice] = await client.insert(invoicesTable).values(input).returning();
    return invoice;
  }

  async updateStatus(companyId: string, invoiceId: string, status: string, client: DbOrTx = db) {
    const [invoice] = await client
      .update(invoicesTable)
      .set({ status, updatedAt: new Date() })
      .where(compositeKeyMatch(invoicesTable.companyId, invoicesTable.id, companyId, invoiceId))
      .returning();
    return invoice ?? null;
  }

  async saveXml(entry: typeof invoiceXmlTable.$inferInsert, client: DbOrTx = db) {
    const [row] = await client.insert(invoiceXmlTable).values(entry).returning();
    return row;
  }

  async findXmlByInvoiceId(companyId: string, invoiceId: string, client: DbOrTx = db) {
    const [row] = await client
      .select()
      .from(invoiceXmlTable)
      .where(withTenantScope(invoiceXmlTable.companyId, companyId, eq(invoiceXmlTable.invoiceId, invoiceId)))
      .limit(1);
    return row ?? null;
  }

  async saveSignature(entry: typeof signaturesTable.$inferInsert, client: DbOrTx = db) {
    const [row] = await client.insert(signaturesTable).values(entry).returning();
    return row;
  }

  async findSignatureByInvoiceId(companyId: string, invoiceId: string, client: DbOrTx = db) {
    const [row] = await client
      .select()
      .from(signaturesTable)
      .where(withTenantScope(signaturesTable.companyId, companyId, eq(signaturesTable.invoiceId, invoiceId)))
      .limit(1);
    return row ?? null;
  }

  async saveQrCode(entry: typeof qrCodesTable.$inferInsert, client: DbOrTx = db) {
    const [row] = await client.insert(qrCodesTable).values(entry).returning();
    return row;
  }

  async findQrByInvoiceId(companyId: string, invoiceId: string, client: DbOrTx = db) {
    const [row] = await client
      .select()
      .from(qrCodesTable)
      .where(withTenantScope(qrCodesTable.companyId, companyId, eq(qrCodesTable.invoiceId, invoiceId)))
      .limit(1);
    return row ?? null;
  }
}

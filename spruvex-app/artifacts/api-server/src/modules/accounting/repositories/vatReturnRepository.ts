import { eq, and, gte, lte, ne } from "drizzle-orm";
import { vatReturnsTable, invoicesTable, purchaseInvoicesTable, type VatReturn, type InsertVatReturn } from "@workspace/db";
import type { DbClient } from "../types";

export interface VatReturnUpdate {
  status: "finalized";
  finalizedAt: Date;
  finalizedBy: string;
}

export const vatReturnRepository = {
  async list(db: DbClient, companyId: string): Promise<VatReturn[]> {
    return db.select().from(vatReturnsTable)
      .where(eq(vatReturnsTable.companyId, companyId))
      .orderBy(vatReturnsTable.periodStart);
  },

  async findById(db: DbClient, companyId: string, id: string): Promise<VatReturn | undefined> {
    const [row] = await db.select().from(vatReturnsTable)
      .where(and(eq(vatReturnsTable.id, id), eq(vatReturnsTable.companyId, companyId)));
    return row;
  },

  async insert(db: DbClient, row: InsertVatReturn): Promise<VatReturn> {
    const [created] = await db.insert(vatReturnsTable).values(row).returning();
    return created;
  },

  async finalize(db: DbClient, companyId: string, id: string, changes: VatReturnUpdate): Promise<VatReturn | undefined> {
    const [updated] = await db.update(vatReturnsTable).set(changes)
      .where(and(eq(vatReturnsTable.id, id), eq(vatReturnsTable.companyId, companyId), eq(vatReturnsTable.status, "draft")))
      .returning();
    return updated;
  },

  // Output VAT: every non-draft ZATCA invoice issued in the period. Credit
  // notes reverse a prior sale's tax (subtracted), debit notes add to it —
  // both already carry their own sign-correct taxAmount/subtotal since
  // they're separate rows, not adjustments to the original.
  async outputVatInvoices(db: DbClient, companyId: string, from: string, to: string) {
    return db.select({
      invoiceType: invoicesTable.invoiceType,
      subtotal: invoicesTable.subtotal,
      taxAmount: invoicesTable.taxAmount,
    }).from(invoicesTable)
      .where(and(
        eq(invoicesTable.companyId, companyId),
        ne(invoicesTable.status, "draft"),
        gte(invoicesTable.issueDate, new Date(from)),
        lte(invoicesTable.issueDate, new Date(to + "T23:59:59")),
      ));
  },

  // Input VAT: purchase_invoices already carries taxAmount computed from the
  // company's configured taxRate at the time each purchase/purchase-return
  // was recorded (see purchaseInvoiceService) — real recorded data, not
  // invented. sourceType "purchase_return" subtracts.
  async inputVatPurchaseInvoices(db: DbClient, companyId: string, from: string, to: string) {
    return db.select({
      sourceType: purchaseInvoicesTable.sourceType,
      subtotal: purchaseInvoicesTable.subtotal,
      taxAmount: purchaseInvoicesTable.taxAmount,
    }).from(purchaseInvoicesTable)
      .where(and(
        eq(purchaseInvoicesTable.companyId, companyId),
        gte(purchaseInvoicesTable.issueDate, new Date(from)),
        lte(purchaseInvoicesTable.issueDate, new Date(to + "T23:59:59")),
      ));
  },
};

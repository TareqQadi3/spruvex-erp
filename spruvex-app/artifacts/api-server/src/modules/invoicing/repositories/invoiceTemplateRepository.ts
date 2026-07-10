import { and, eq } from "drizzle-orm";
import {
  invoiceTemplatesTable,
  type InsertInvoiceTemplate,
  type InvoiceTemplate,
  type InvoiceTemplateKind,
  type InvoiceTemplatePrintType,
} from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx, Transaction } from "../../../core/database/transaction";
import { withTenantScope } from "../../../core/database/compositeKey";

export class InvoiceTemplateRepository {
  async list(companyId: string, client: DbOrTx = db): Promise<InvoiceTemplate[]> {
    return client
      .select()
      .from(invoiceTemplatesTable)
      .where(withTenantScope(invoiceTemplatesTable.companyId, companyId));
  }

  async findById(companyId: string, id: string, client: DbOrTx = db): Promise<InvoiceTemplate | null> {
    const [row] = await client
      .select()
      .from(invoiceTemplatesTable)
      .where(
        withTenantScope(invoiceTemplatesTable.companyId, companyId, eq(invoiceTemplatesTable.id, id)),
      )
      .limit(1);
    return row ?? null;
  }

  async findByName(companyId: string, name: string, client: DbOrTx = db): Promise<InvoiceTemplate | null> {
    const [row] = await client
      .select()
      .from(invoiceTemplatesTable)
      .where(
        withTenantScope(invoiceTemplatesTable.companyId, companyId, eq(invoiceTemplatesTable.name, name)),
      )
      .limit(1);
    return row ?? null;
  }

  async findDefault(
    companyId: string,
    documentKind: InvoiceTemplateKind,
    printType: InvoiceTemplatePrintType,
    client: DbOrTx = db,
  ): Promise<InvoiceTemplate | null> {
    const [row] = await client
      .select()
      .from(invoiceTemplatesTable)
      .where(
        withTenantScope(
          invoiceTemplatesTable.companyId,
          companyId,
          and(
            eq(invoiceTemplatesTable.documentKind, documentKind),
            eq(invoiceTemplatesTable.printType, printType),
            eq(invoiceTemplatesTable.isDefault, true),
          ),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(input: InsertInvoiceTemplate, client: DbOrTx = db): Promise<InvoiceTemplate> {
    const [row] = await client.insert(invoiceTemplatesTable).values(input).returning();
    return row;
  }

  async update(
    companyId: string,
    id: string,
    fields: Partial<Omit<InsertInvoiceTemplate, "companyId">>,
    client: DbOrTx = db,
  ): Promise<InvoiceTemplate | null> {
    const [row] = await client
      .update(invoiceTemplatesTable)
      .set({ ...fields, updatedAt: new Date() })
      .where(
        withTenantScope(invoiceTemplatesTable.companyId, companyId, eq(invoiceTemplatesTable.id, id)),
      )
      .returning();
    return row ?? null;
  }

  async delete(companyId: string, id: string, client: DbOrTx = db): Promise<boolean> {
    const rows = await client
      .delete(invoiceTemplatesTable)
      .where(
        withTenantScope(invoiceTemplatesTable.companyId, companyId, eq(invoiceTemplatesTable.id, id)),
      )
      .returning({ id: invoiceTemplatesTable.id });
    return rows.length > 0;
  }

  // Clears isDefault on every other template matching (companyId, documentKind,
  // printType) — must be called inside the same transaction as the insert/update
  // that sets the new default, so there's never a moment with two defaults.
  async clearDefaults(
    companyId: string,
    documentKind: InvoiceTemplateKind,
    printType: InvoiceTemplatePrintType,
    tx: Transaction,
  ): Promise<void> {
    await tx
      .update(invoiceTemplatesTable)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        withTenantScope(
          invoiceTemplatesTable.companyId,
          companyId,
          and(
            eq(invoiceTemplatesTable.documentKind, documentKind),
            eq(invoiceTemplatesTable.printType, printType),
            eq(invoiceTemplatesTable.isDefault, true),
          ),
        ),
      );
  }
}

export const invoiceTemplateRepository = new InvoiceTemplateRepository();

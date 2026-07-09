import { inArray, sql } from "drizzle-orm";
import {
  cashSessionsTable,
  customersTable,
  paymentMethodsTable,
  productsTable,
  saleItemsTable,
  salePaymentsTable,
  salesTable,
} from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { compositeKeyMatch, withTenantScope } from "../../../core/database/compositeKey";

export class SaleRepository {
  // FOR UPDATE locks each product row for the rest of the transaction — a
  // concurrent sale against the same product blocks here instead of racing
  // past the stock check the caller does against product.stock before
  // deducting (deduction itself now goes through the inventory engine —
  // see modules/pos/services/stockDeductionService.ts).
  async findProductsForUpdate(companyId: string, productIds: string[], client: DbOrTx = db) {
    if (productIds.length === 0) return [];
    return client
      .select()
      .from(productsTable)
      .where(withTenantScope(productsTable.companyId, companyId, inArray(productsTable.id, productIds)))
      .for("update");
  }

  async findPaymentMethods(companyId: string, methodIds: string[], client: DbOrTx = db) {
    if (methodIds.length === 0) return [];
    return client
      .select()
      .from(paymentMethodsTable)
      .where(withTenantScope(paymentMethodsTable.companyId, companyId, inArray(paymentMethodsTable.id, methodIds)));
  }

  async findCustomerById(companyId: string, customerId: string, client: DbOrTx = db) {
    const [customer] = await client
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(compositeKeyMatch(customersTable.companyId, customersTable.id, companyId, customerId))
      .limit(1);
    return customer ?? null;
  }

  async findCashSessionById(companyId: string, cashSessionId: string, client: DbOrTx = db) {
    const [session] = await client
      .select()
      .from(cashSessionsTable)
      .where(compositeKeyMatch(cashSessionsTable.companyId, cashSessionsTable.id, companyId, cashSessionId))
      .limit(1);
    return session ?? null;
  }

  async createSale(input: typeof salesTable.$inferInsert, client: DbOrTx = db) {
    const [sale] = await client.insert(salesTable).values(input).returning();
    return sale;
  }

  async createSaleItems(items: (typeof saleItemsTable.$inferInsert)[], client: DbOrTx = db) {
    if (items.length === 0) return [];
    return client.insert(saleItemsTable).values(items).returning();
  }

  // Raw SQL, not client.insert(salePaymentsTable): the live sale_payments
  // table is missing the created_at column the Drizzle schema declares
  // (pre-existing drift, unrelated to this change) — Drizzle's insert builder
  // always emits every schema-declared column (using `default` for any not
  // provided), which references created_at regardless of batch vs single-row
  // and fails against the real table. Listing only the columns that actually
  // exist sidesteps it without an ALTER TABLE.
  async createSalePayments(payments: (typeof salePaymentsTable.$inferInsert)[], client: DbOrTx = db) {
    const rows: Array<{
      id: string;
      companyId: string;
      saleId: string;
      paymentMethodId: string | null;
      methodName: string;
      amount: string;
    }> = [];
    for (const payment of payments) {
      const result = await client.execute<{
        id: string;
        company_id: string;
        sale_id: string;
        payment_method_id: string | null;
        method_name: string;
        amount: string;
      }>(sql`
        INSERT INTO sale_payments (company_id, sale_id, payment_method_id, method_name, amount)
        VALUES (${payment.companyId}, ${payment.saleId}, ${payment.paymentMethodId}, ${payment.methodName}, ${payment.amount})
        RETURNING id, company_id, sale_id, payment_method_id, method_name, amount
      `);
      const row = result.rows[0];
      rows.push({
        id: row.id,
        companyId: row.company_id,
        saleId: row.sale_id,
        paymentMethodId: row.payment_method_id,
        methodName: row.method_name,
        amount: row.amount,
      });
    }
    return rows;
  }
}

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  paymentGatewaySettingsTable,
  paymentTransactionsTable,
  salesTable,
  salePaymentsTable,
  ecommerceOrdersTable,
  type PaymentGatewaySettings,
  type PaymentTransaction,
  type Sale,
  type EcommerceOrder,
  type SalePayment,
} from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { withTenantScope, compositeKeyMatch } from "../../../core/database/compositeKey";

export interface ListTransactionsFilters {
  page: number;
  pageSize: number;
  provider?: string;
  status?: string;
  source?: string;
}

export class PaymentsRepository {
  // --- gateway settings -------------------------------------------------

  async listGatewaySettings(companyId: string, client: DbOrTx = db): Promise<PaymentGatewaySettings[]> {
    return client
      .select()
      .from(paymentGatewaySettingsTable)
      .where(eq(paymentGatewaySettingsTable.companyId, companyId));
  }

  async findGatewaySettings(
    companyId: string,
    provider: string,
    client: DbOrTx = db,
  ): Promise<PaymentGatewaySettings | null> {
    const [row] = await client
      .select()
      .from(paymentGatewaySettingsTable)
      .where(
        withTenantScope(paymentGatewaySettingsTable.companyId, companyId, eq(paymentGatewaySettingsTable.provider, provider)),
      )
      .limit(1);
    return row ?? null;
  }

  async upsertGatewaySettings(
    input: {
      companyId: string;
      provider: string;
      credentials?: Record<string, unknown> | null;
      mode?: string;
      isActive?: boolean;
    },
    client: DbOrTx = db,
  ): Promise<PaymentGatewaySettings> {
    const setFields: Record<string, unknown> = { updatedAt: new Date() };
    if (input.credentials !== undefined) setFields.credentials = input.credentials;
    if (input.mode !== undefined) setFields.mode = input.mode;
    if (input.isActive !== undefined) setFields.isActive = input.isActive;

    const [row] = await client
      .insert(paymentGatewaySettingsTable)
      .values({
        companyId: input.companyId,
        provider: input.provider,
        credentials: input.credentials ?? null,
        mode: input.mode ?? "test",
        isActive: input.isActive ?? true,
      })
      .onConflictDoUpdate({
        target: [paymentGatewaySettingsTable.companyId, paymentGatewaySettingsTable.provider],
        set: setFields,
      })
      .returning();
    return row;
  }

  // --- transactions -------------------------------------------------------

  async insertTransaction(
    input: {
      companyId: string;
      provider: string;
      source: string;
      sourceId: string;
      saleId?: string | null;
      amount: string;
      currency?: string;
      status?: string;
      idempotencyKey?: string | null;
    },
    client: DbOrTx = db,
  ): Promise<PaymentTransaction> {
    const [row] = await client.insert(paymentTransactionsTable).values(input).returning();
    return row;
  }

  async updateTransactionById(
    companyId: string,
    id: string,
    fields: Partial<
      Pick<
        PaymentTransaction,
        "externalId" | "checkoutUrl" | "status" | "errorMessage" | "payload" | "amount"
      >
    >,
    client: DbOrTx = db,
  ): Promise<PaymentTransaction | null> {
    const [row] = await client
      .update(paymentTransactionsTable)
      .set({ ...fields, updatedAt: new Date() })
      .where(compositeKeyMatch(paymentTransactionsTable.companyId, paymentTransactionsTable.id, companyId, id))
      .returning();
    return row ?? null;
  }

  // Atomically claims a transaction for capture: the status filter makes the
  // UPDATE itself the race arbiter, so two concurrent capture webhooks (or a
  // webhook racing the manual refresh endpoint) can never both win — the
  // loser matches zero rows and gets null, which the service treats as a
  // duplicate. A plain read-then-update would let both writers through and
  // settle the sale twice.
  async claimTransactionForCapture(
    companyId: string,
    id: string,
    payload: unknown,
    client: DbOrTx = db,
  ): Promise<PaymentTransaction | null> {
    const [row] = await client
      .update(paymentTransactionsTable)
      .set({ status: "captured", payload, updatedAt: new Date() })
      .where(
        and(
          compositeKeyMatch(paymentTransactionsTable.companyId, paymentTransactionsTable.id, companyId, id),
          inArray(paymentTransactionsTable.status, ["created", "pending"]),
        ),
      )
      .returning();
    return row ?? null;
  }

  async findTransactionById(companyId: string, id: string, client: DbOrTx = db): Promise<PaymentTransaction | null> {
    const [row] = await client
      .select()
      .from(paymentTransactionsTable)
      .where(compositeKeyMatch(paymentTransactionsTable.companyId, paymentTransactionsTable.id, companyId, id))
      .limit(1);
    return row ?? null;
  }

  async findTransactionByIdempotencyKey(
    companyId: string,
    idempotencyKey: string,
    client: DbOrTx = db,
  ): Promise<PaymentTransaction | null> {
    const [row] = await client
      .select()
      .from(paymentTransactionsTable)
      .where(
        withTenantScope(
          paymentTransactionsTable.companyId,
          companyId,
          eq(paymentTransactionsTable.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  // Webhook-only lookup: intentionally NOT scoped by companyId — a webhook
  // arrives with only (provider, externalId), and the company is resolved
  // from the row that comes back, not from any caller-supplied context.
  async findTransactionByProviderExternalIdUnscoped(
    provider: string,
    externalId: string,
    client: DbOrTx = db,
  ): Promise<PaymentTransaction | null> {
    const [row] = await client
      .select()
      .from(paymentTransactionsTable)
      .where(and(eq(paymentTransactionsTable.provider, provider), eq(paymentTransactionsTable.externalId, externalId)))
      .limit(1);
    return row ?? null;
  }

  async listTransactions(
    companyId: string,
    filters: ListTransactionsFilters,
    client: DbOrTx = db,
  ): Promise<{ rows: PaymentTransaction[]; total: number }> {
    const extra = [
      filters.provider ? eq(paymentTransactionsTable.provider, filters.provider) : undefined,
      filters.status ? eq(paymentTransactionsTable.status, filters.status) : undefined,
      filters.source ? eq(paymentTransactionsTable.source, filters.source) : undefined,
    ];
    const conditions = withTenantScope(paymentTransactionsTable.companyId, companyId, ...extra);
    const offset = (filters.page - 1) * filters.pageSize;

    const [rows, [{ count }]] = await Promise.all([
      client
        .select()
        .from(paymentTransactionsTable)
        .where(conditions)
        .orderBy(desc(paymentTransactionsTable.createdAt))
        .limit(filters.pageSize)
        .offset(offset),
      client.select({ count: sql<number>`count(*)::int` }).from(paymentTransactionsTable).where(conditions),
    ]);

    return { rows, total: count };
  }

  // --- source lookups -------------------------------------------------------

  async findSaleById(companyId: string, saleId: string, client: DbOrTx = db): Promise<Sale | null> {
    const [row] = await client
      .select()
      .from(salesTable)
      .where(compositeKeyMatch(salesTable.companyId, salesTable.id, companyId, saleId))
      .limit(1);
    return row ?? null;
  }

  async findEcommerceOrderById(companyId: string, orderId: string, client: DbOrTx = db): Promise<EcommerceOrder | null> {
    const [row] = await client
      .select()
      .from(ecommerceOrdersTable)
      .where(compositeKeyMatch(ecommerceOrdersTable.companyId, ecommerceOrdersTable.id, companyId, orderId))
      .limit(1);
    return row ?? null;
  }

  // --- capture write helpers (called inside withTransaction) ---------------

  async insertSalePayment(
    input: { companyId: string; saleId: string; paymentMethodId: string | null; methodName: string; amount: string },
    client: DbOrTx = db,
  ): Promise<SalePayment> {
    const [row] = await client.insert(salePaymentsTable).values(input).returning();
    return row;
  }

  // Increment in SQL rather than read-modify-write so concurrent settlements
  // against the same sale can't lose an update.
  async incrementSaleAmountPaid(companyId: string, saleId: string, amount: string, client: DbOrTx = db): Promise<void> {
    await client
      .update(salesTable)
      .set({ amountPaid: sql`${salesTable.amountPaid} + ${amount}` })
      .where(compositeKeyMatch(salesTable.companyId, salesTable.id, companyId, saleId));
  }
}

export const paymentsRepository = new PaymentsRepository();

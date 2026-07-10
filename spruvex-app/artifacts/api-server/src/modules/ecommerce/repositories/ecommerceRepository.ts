import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  ecommerceConnectionsTable,
  ecommerceOrdersTable,
  productExternalMappingsTable,
  productsTable,
  type EcommerceConnection,
  type EcommerceOrder,
  type InsertEcommerceConnection,
  type InsertEcommerceOrder,
  type InsertProductExternalMapping,
  type ProductExternalMapping,
} from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { withTenantScope } from "../../../core/database/compositeKey";

export interface ListOrdersFilters {
  page: number;
  pageSize: number;
  status?: string;
  connectionId?: string;
}

export interface ListMappingsFilters {
  page: number;
  pageSize: number;
}

export class EcommerceRepository {
  // --- connections ---------------------------------------------------------

  async createConnection(input: InsertEcommerceConnection, client: DbOrTx = db): Promise<EcommerceConnection> {
    const [row] = await client.insert(ecommerceConnectionsTable).values(input).returning();
    return row;
  }

  async findConnectionById(companyId: string, id: string, client: DbOrTx = db): Promise<EcommerceConnection | null> {
    const [row] = await client
      .select()
      .from(ecommerceConnectionsTable)
      .where(withTenantScope(ecommerceConnectionsTable.companyId, companyId, eq(ecommerceConnectionsTable.id, id)))
      .limit(1);
    return row ?? null;
  }

  // Webhook path only: the webhook request is unauthenticated (no JWT, no
  // tenant context yet), so the connection is looked up by id alone and the
  // company id is then read FROM the returned row — never accept companyId
  // from the webhook request itself.
  async findConnectionByIdUnscoped(id: string, client: DbOrTx = db): Promise<EcommerceConnection | null> {
    const [row] = await client
      .select()
      .from(ecommerceConnectionsTable)
      .where(eq(ecommerceConnectionsTable.id, id))
      .limit(1);
    return row ?? null;
  }

  async listConnections(companyId: string, client: DbOrTx = db): Promise<EcommerceConnection[]> {
    return client
      .select()
      .from(ecommerceConnectionsTable)
      .where(eq(ecommerceConnectionsTable.companyId, companyId))
      .orderBy(desc(ecommerceConnectionsTable.createdAt));
  }

  async updateConnection(
    companyId: string,
    id: string,
    fields: Partial<Pick<EcommerceConnection, "storeUrl" | "credentials" | "status" | "lastSyncedAt">>,
    client: DbOrTx = db,
  ): Promise<EcommerceConnection | null> {
    const [row] = await client
      .update(ecommerceConnectionsTable)
      .set(fields)
      .where(withTenantScope(ecommerceConnectionsTable.companyId, companyId, eq(ecommerceConnectionsTable.id, id)))
      .returning();
    return row ?? null;
  }

  // --- product <-> external mappings ---------------------------------------

  async upsertMapping(input: InsertProductExternalMapping, client: DbOrTx = db): Promise<ProductExternalMapping> {
    const [row] = await client
      .insert(productExternalMappingsTable)
      .values(input)
      .onConflictDoUpdate({
        target: [productExternalMappingsTable.connectionId, productExternalMappingsTable.productId],
        set: {
          externalId: input.externalId,
          externalSku: input.externalSku,
          syncStatus: input.syncStatus,
          lastSyncedAt: input.lastSyncedAt,
        },
      })
      .returning();
    return row;
  }

  async findMapping(connectionId: string, productId: string, client: DbOrTx = db): Promise<ProductExternalMapping | null> {
    const [row] = await client
      .select()
      .from(productExternalMappingsTable)
      .where(
        and(
          eq(productExternalMappingsTable.connectionId, connectionId),
          eq(productExternalMappingsTable.productId, productId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  // Resolves external -> local product for a whole connection in one query —
  // used by order import to map every line item's externalProductId back to
  // a local productId.
  async findMappingsByConnection(
    companyId: string,
    connectionId: string,
    client: DbOrTx = db,
  ): Promise<ProductExternalMapping[]> {
    return client
      .select()
      .from(productExternalMappingsTable)
      .where(
        withTenantScope(productExternalMappingsTable.companyId, companyId, eq(productExternalMappingsTable.connectionId, connectionId)),
      );
  }

  // Failure path for pushProducts: no externalId was returned by the
  // provider, so this only flips syncStatus on an existing mapping row — it
  // never creates one (there is nothing yet to map to).
  async markMappingError(companyId: string, connectionId: string, productId: string, client: DbOrTx = db): Promise<void> {
    await client
      .update(productExternalMappingsTable)
      .set({ syncStatus: "error" })
      .where(
        withTenantScope(
          productExternalMappingsTable.companyId,
          companyId,
          and(
            eq(productExternalMappingsTable.connectionId, connectionId),
            eq(productExternalMappingsTable.productId, productId),
          ),
        ),
      );
  }

  async listMappings(
    companyId: string,
    connectionId: string,
    filters: ListMappingsFilters,
    client: DbOrTx = db,
  ): Promise<{ rows: ProductExternalMapping[]; total: number }> {
    const conditions = withTenantScope(
      productExternalMappingsTable.companyId,
      companyId,
      eq(productExternalMappingsTable.connectionId, connectionId),
    );
    const offset = (filters.page - 1) * filters.pageSize;

    const [rows, [{ count }]] = await Promise.all([
      client
        .select()
        .from(productExternalMappingsTable)
        .where(conditions)
        .orderBy(desc(productExternalMappingsTable.createdAt))
        .limit(filters.pageSize)
        .offset(offset),
      client.select({ count: sql<number>`count(*)::int` }).from(productExternalMappingsTable).where(conditions),
    ]);

    return { rows, total: count };
  }

  // --- staged orders ---------------------------------------------------------

  // Dedupe on (connectionId, externalOrderId) is enforced by the unique index —
  // this is a thin wrapper. Returns the inserted row, or undefined if a row
  // already existed for that (connection, external order) pair.
  async insertOrderIfNew(input: InsertEcommerceOrder, client: DbOrTx = db): Promise<EcommerceOrder | undefined> {
    const [row] = await client.insert(ecommerceOrdersTable).values(input).onConflictDoNothing().returning();
    return row;
  }

  async findOrderById(companyId: string, id: string, client: DbOrTx = db): Promise<EcommerceOrder | null> {
    const [row] = await client
      .select()
      .from(ecommerceOrdersTable)
      .where(withTenantScope(ecommerceOrdersTable.companyId, companyId, eq(ecommerceOrdersTable.id, id)))
      .limit(1);
    return row ?? null;
  }

  async listOrders(
    companyId: string,
    filters: ListOrdersFilters,
    client: DbOrTx = db,
  ): Promise<{ rows: EcommerceOrder[]; total: number }> {
    const extra = [
      filters.status ? eq(ecommerceOrdersTable.status, filters.status) : undefined,
      filters.connectionId ? eq(ecommerceOrdersTable.connectionId, filters.connectionId) : undefined,
    ];
    const conditions = withTenantScope(ecommerceOrdersTable.companyId, companyId, ...extra);
    const offset = (filters.page - 1) * filters.pageSize;

    const [rows, [{ count }]] = await Promise.all([
      client
        .select()
        .from(ecommerceOrdersTable)
        .where(conditions)
        .orderBy(desc(ecommerceOrdersTable.createdAt))
        .limit(filters.pageSize)
        .offset(offset),
      client.select({ count: sql<number>`count(*)::int` }).from(ecommerceOrdersTable).where(conditions),
    ]);

    return { rows, total: count };
  }

  // Atomically claims a staged order for import: the status filter makes the
  // UPDATE the race arbiter, so two concurrent import requests (double-click,
  // retried HTTP call) can never both proceed to createSale — the loser
  // matches zero rows, gets null, and creates no duplicate sale/stock
  // deduction. "importing" is a transient claim state; the service always
  // moves it on to "imported" or "failed" before returning.
  async claimOrderForImport(companyId: string, id: string, client: DbOrTx = db): Promise<EcommerceOrder | null> {
    const [row] = await client
      .update(ecommerceOrdersTable)
      .set({ status: "importing" })
      .where(
        and(
          withTenantScope(ecommerceOrdersTable.companyId, companyId, eq(ecommerceOrdersTable.id, id)),
          inArray(ecommerceOrdersTable.status, ["received", "failed"]),
        ),
      )
      .returning();
    return row ?? null;
  }

  async updateOrderStatus(
    companyId: string,
    id: string,
    fields: Partial<Pick<EcommerceOrder, "status" | "errorMessage" | "saleId" | "importedAt">>,
    client: DbOrTx = db,
  ): Promise<EcommerceOrder | null> {
    const [row] = await client
      .update(ecommerceOrdersTable)
      .set(fields)
      .where(withTenantScope(ecommerceOrdersTable.companyId, companyId, eq(ecommerceOrdersTable.id, id)))
      .returning();
    return row ?? null;
  }

  // --- products lookup (for pushProducts) -------------------------------------

  async findProductsByIds(companyId: string, productIds: string[], client: DbOrTx = db) {
    if (productIds.length === 0) return [];
    return client
      .select()
      .from(productsTable)
      .where(withTenantScope(productsTable.companyId, companyId, inArray(productsTable.id, productIds)));
  }
}

export const ecommerceRepository = new EcommerceRepository();

import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

import { TenantContextService } from "../tenancy/tenant-context.service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Builds a tenant-scoped client: every operation runs inside a transaction that
 * first sets `app.current_tenant_id` (transaction-local), which Postgres RLS
 * policies use to filter rows. This is the standard Prisma RLS extension pattern.
 */
function createTenantClient(base: PrismaClient, tenantId: string) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await base.$transaction([
            base.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

export type TenantScopedClient = ReturnType<typeof createTenantClient>;

/**
 * Database access for the API.
 *
 * - Connects as `spruvex_app` (NOBYPASSRLS): even a query that forgets tenant
 *   scoping returns nothing rather than leaking cross-tenant data.
 * - `scoped` returns a client bound to the current request's tenant; all
 *   business queries must go through it (never through the base client).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly tenantClients = new Map<string, TenantScopedClient>();

  constructor(private readonly tenantContext: TenantContextService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Tenant-scoped client for the current request context. */
  get scoped(): TenantScopedClient {
    return this.forTenant(this.tenantContext.tenantIdOrThrow);
  }

  /**
   * Multi-statement transaction under the current tenant's RLS context.
   * The per-operation extension cannot cover interactive transactions (the
   * callback runs on a dedicated connection), so this helper opens the
   * transaction and sets `app.current_tenant_id` as its first statement —
   * every query inside is RLS-enforced. Use for atomic multi-row writes
   * (e.g. order + items + history).
   */
  async scopedTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    tenantId?: string,
  ): Promise<T> {
    const tid = tenantId ?? this.tenantContext.tenantIdOrThrow;
    if (!UUID_RE.test(tid)) {
      throw new Error(`Invalid tenant id: ${tid}`);
    }
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tid}, TRUE)`;
      return fn(tx);
    });
  }

  /** Tenant-scoped client for an explicit tenant id (jobs, seeds of tenant data). */
  forTenant(tenantId: string): TenantScopedClient {
    if (!UUID_RE.test(tenantId)) {
      throw new Error(`Invalid tenant id: ${tenantId}`);
    }
    let client = this.tenantClients.get(tenantId);
    if (!client) {
      client = createTenantClient(this, tenantId);
      this.tenantClients.set(tenantId, client);
    }
    return client;
  }
}

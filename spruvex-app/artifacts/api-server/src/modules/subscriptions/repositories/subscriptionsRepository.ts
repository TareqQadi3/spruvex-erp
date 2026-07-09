import { desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import {
  companiesTable,
  companyAddonsTable,
  subscriptionsTable,
  usersTable,
  type Company,
  type CompanyAddon,
  type Subscription,
} from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { withTenantScope } from "../../../core/database/compositeKey";

export class SubscriptionsRepository {
  async findCompanyById(companyId: string, client: DbOrTx = db): Promise<Company | null> {
    const [row] = await client.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
    return row ?? null;
  }

  // Subscriptions are append-only per plan/billing change (see subscriptions.ts) —
  // "latest by createdAt" is always the currently-in-effect row.
  async findLatestSubscription(companyId: string, client: DbOrTx = db): Promise<Subscription | null> {
    const [row] = await client
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.companyId, companyId))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);
    return row ?? null;
  }

  async findActiveAddons(companyId: string, client: DbOrTx = db): Promise<CompanyAddon[]> {
    const now = new Date();
    return client
      .select()
      .from(companyAddonsTable)
      .where(
        withTenantScope(
          companyAddonsTable.companyId,
          companyId,
          eq(companyAddonsTable.isActive, true),
          or(isNull(companyAddonsTable.expiresAt), gt(companyAddonsTable.expiresAt, now)),
        ),
      );
  }

  async countActiveUsers(companyId: string, client: DbOrTx = db): Promise<number> {
    const [row] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(withTenantScope(usersTable.companyId, companyId, eq(usersTable.isActive, true)));
    return row?.count ?? 0;
  }
}

export const subscriptionsRepository = new SubscriptionsRepository();

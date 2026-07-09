import { and, eq } from "drizzle-orm";
import {
  companiesTable,
  companyAddonsTable,
  subscriptionsTable,
  type Company,
  type CompanyAddon,
  type InsertCompanyAddon,
} from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";

// Deliberately not tenant-scoped — every method here can read/write across
// every company, by design (see platformAdmin.middleware.ts). Reads for a
// single company's latest subscription / active add-ons reuse
// subscriptionsRepository (modules/subscriptions) rather than duplicating
// that query here.
export class PlatformRepository {
  async listCompanies(client: DbOrTx = db): Promise<Company[]> {
    return client.select().from(companiesTable);
  }

  async findCompanyById(companyId: string, client: DbOrTx = db): Promise<Company | null> {
    const [row] = await client.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
    return row ?? null;
  }

  async updateCompanyPlanAndModules(
    companyId: string,
    fields: { plan: string; enabledModules: string },
    client: DbOrTx = db,
  ): Promise<Company | null> {
    const [row] = await client
      .update(companiesTable)
      .set(fields)
      .where(eq(companiesTable.id, companyId))
      .returning();
    return row ?? null;
  }

  async updateCompanyStatus(companyId: string, status: string, client: DbOrTx = db): Promise<Company | null> {
    const [row] = await client
      .update(companiesTable)
      .set({ status })
      .where(eq(companiesTable.id, companyId))
      .returning();
    return row ?? null;
  }

  async updateSubscriptionPlan(subscriptionId: string, plan: string, client: DbOrTx = db): Promise<void> {
    await client.update(subscriptionsTable).set({ plan }).where(eq(subscriptionsTable.id, subscriptionId));
  }

  // Manual stand-in for what a payment webhook would normally drive — there's
  // no payment gateway yet (see plan doc), so a platform admin renewing a
  // subscription by hand is how "expired -> active" ever happens right now.
  async renewSubscription(
    subscriptionId: string,
    fields: { status: string; currentPeriodEnd: Date },
    client: DbOrTx = db,
  ): Promise<void> {
    await client.update(subscriptionsTable).set(fields).where(eq(subscriptionsTable.id, subscriptionId));
  }

  async findCompanyAddon(companyId: string, addonCode: string, client: DbOrTx = db): Promise<CompanyAddon | null> {
    const [row] = await client
      .select()
      .from(companyAddonsTable)
      .where(and(eq(companyAddonsTable.companyId, companyId), eq(companyAddonsTable.addonCode, addonCode)))
      .limit(1);
    return row ?? null;
  }

  async insertCompanyAddon(input: InsertCompanyAddon, client: DbOrTx = db): Promise<CompanyAddon> {
    const [row] = await client.insert(companyAddonsTable).values(input).returning();
    return row;
  }

  async updateCompanyAddon(
    companyId: string,
    addonCode: string,
    fields: { isActive: boolean; quantity: number | null },
    client: DbOrTx = db,
  ): Promise<CompanyAddon | null> {
    const [row] = await client
      .update(companyAddonsTable)
      .set(fields)
      .where(and(eq(companyAddonsTable.companyId, companyId), eq(companyAddonsTable.addonCode, addonCode)))
      .returning();
    return row ?? null;
  }
}

export const platformRepository = new PlatformRepository();

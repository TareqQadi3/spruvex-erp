import { eq, and, desc } from "drizzle-orm";
import { affiliatesTable, referralConversionsTable, type Affiliate, type InsertAffiliate, type ReferralConversion, type InsertReferralConversion } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface ConversionStatusUpdate {
  status: "approved" | "paid";
  approvedAt?: Date;
  paidAt?: Date;
}

export const affiliateRepository = {
  async list(db: DbClient): Promise<Affiliate[]> {
    return db.select().from(affiliatesTable).orderBy(affiliatesTable.name);
  },

  async findById(db: DbClient, id: string): Promise<Affiliate | undefined> {
    const [row] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.id, id));
    return row;
  },

  async findByReferralCode(db: DbClient, referralCode: string): Promise<Affiliate | undefined> {
    const [row] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.referralCode, referralCode));
    return row;
  },

  async findByEmail(db: DbClient, email: string): Promise<Affiliate | undefined> {
    const [row] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.email, email));
    return row;
  },

  async insert(db: DbClient, row: InsertAffiliate): Promise<Affiliate> {
    const [affiliate] = await db.insert(affiliatesTable).values(row).returning();
    return affiliate;
  },

  async listConversions(db: DbClient, affiliateId?: string, status?: string): Promise<ReferralConversion[]> {
    const conditions = [];
    if (affiliateId) conditions.push(eq(referralConversionsTable.affiliateId, affiliateId));
    if (status) conditions.push(eq(referralConversionsTable.status, status));
    const query = db.select().from(referralConversionsTable).orderBy(desc(referralConversionsTable.reportedAt));
    return conditions.length > 0 ? query.where(and(...conditions)) : query;
  },

  async findConversionByProductAndCompany(db: DbClient, product: string, externalCompanyId: string): Promise<ReferralConversion | undefined> {
    const [row] = await db.select().from(referralConversionsTable)
      .where(and(eq(referralConversionsTable.product, product), eq(referralConversionsTable.externalCompanyId, externalCompanyId)));
    return row;
  },

  async findConversionById(db: DbClient, id: string): Promise<ReferralConversion | undefined> {
    const [row] = await db.select().from(referralConversionsTable).where(eq(referralConversionsTable.id, id));
    return row;
  },

  async insertConversion(db: DbClient, row: InsertReferralConversion): Promise<ReferralConversion> {
    const [conversion] = await db.insert(referralConversionsTable).values(row).returning();
    return conversion;
  },

  async updateConversionStatus(db: DbClient, id: string, changes: ConversionStatusUpdate): Promise<ReferralConversion | undefined> {
    const [updated] = await db.update(referralConversionsTable).set(changes)
      .where(eq(referralConversionsTable.id, id))
      .returning();
    return updated;
  },
};

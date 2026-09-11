import { randomBytes } from "node:crypto";
import { db, PLAN_CATALOG, type Affiliate, type ReferralConversion, type PlanCode } from "@workspace/db";
import { isUniqueViolation } from "../../../lib/validation";
import { affiliateRepository } from "../repositories/affiliateRepository";

export class DuplicateAffiliateError extends Error {}

function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export interface CreateAffiliateInput {
  name: string;
  email: string;
  commissionRatePercent?: number;
}

export async function listAffiliates(): Promise<Affiliate[]> {
  return affiliateRepository.list(db);
}

export async function createAffiliate(input: CreateAffiliateInput): Promise<Affiliate> {
  if (!input.name || !input.email) throw new Error("name and email are required");
  const existing = await affiliateRepository.findByEmail(db, input.email);
  if (existing) throw new DuplicateAffiliateError("An affiliate with this email already exists");

  let referralCode = generateReferralCode();
  // Astronomically unlikely to collide (4 random bytes = 4B combinations),
  // but check anyway rather than relying on that alone — retry once.
  if (await affiliateRepository.findByReferralCode(db, referralCode)) {
    referralCode = generateReferralCode();
  }

  return affiliateRepository.insert(db, {
    name: input.name,
    email: input.email,
    referralCode,
    commissionRatePercent: (input.commissionRatePercent ?? 10).toString(),
  });
}

export async function listConversions(affiliateId?: string, status?: string): Promise<ReferralConversion[]> {
  return affiliateRepository.listConversions(db, affiliateId, status);
}

// Pure — the actual SAR math, separated from the DB-touching report flow
// below so it's unit-testable without a database.
export function computeCommission(subscriptionValueSar: number, commissionRatePercent: number): number {
  return Math.round(subscriptionValueSar * (commissionRatePercent / 100) * 100) / 100;
}

export class UnknownReferralCodeError extends Error {}
export class InactiveAffiliateError extends Error {}
export class DuplicateConversionError extends Error {}
export class UnknownPlanError extends Error {}

export interface ReportConversionInput {
  referralCode: string;
  product: "erp" | "r";
  externalCompanyId: string;
  companyName: string;
  planCode: string;
}

// Records that a referred signup happened. Deliberately does NOT verify the
// company actually became a paying customer — a company starts on a trial
// at signup (see authService.registerCompany), not a paid subscription. The
// row starts "pending" precisely so a platform admin reviews/approves
// before any commission is treated as truly owed — that manual step is
// where "did this actually convert" gets checked, not here.
export async function reportConversion(input: ReportConversionInput): Promise<ReferralConversion> {
  const affiliate = await affiliateRepository.findByReferralCode(db, input.referralCode);
  if (!affiliate) throw new UnknownReferralCodeError(`No affiliate found for referral code "${input.referralCode}"`);
  if (affiliate.status !== "active") throw new InactiveAffiliateError("This affiliate is not active");

  const existing = await affiliateRepository.findConversionByProductAndCompany(db, input.product, input.externalCompanyId);
  if (existing) throw new DuplicateConversionError("This company has already been reported as a referral conversion");

  const planLimits = PLAN_CATALOG[input.planCode as PlanCode];
  if (!planLimits || planLimits.priceMonthlySar == null) {
    throw new UnknownPlanError(`Plan "${input.planCode}" has no known price — cannot compute commission`);
  }

  const subscriptionValueSar = planLimits.priceMonthlySar;
  const commissionRatePercent = Number(affiliate.commissionRatePercent);
  const commissionAmountSar = computeCommission(subscriptionValueSar, commissionRatePercent);

  try {
    return await affiliateRepository.insertConversion(db, {
      affiliateId: affiliate.id,
      product: input.product,
      externalCompanyId: input.externalCompanyId,
      companyName: input.companyName,
      planCode: input.planCode,
      subscriptionValueSar: subscriptionValueSar.toString(),
      commissionRatePercent: commissionRatePercent.toString(),
      commissionAmountSar: commissionAmountSar.toString(),
      status: "pending",
    });
  } catch (err) {
    // The in-memory check above is a fast-path only — this unique index
    // (product, externalCompanyId) is the real guarantee against a race
    // between two concurrent report calls for the same company.
    if (isUniqueViolation(err)) throw new DuplicateConversionError("This company has already been reported as a referral conversion");
    throw err;
  }
}

export class InvalidConversionTransitionError extends Error {}
export class ConversionNotFoundError extends Error {}

export async function approveConversion(id: string): Promise<ReferralConversion> {
  const conversion = await affiliateRepository.findConversionById(db, id);
  if (!conversion) throw new ConversionNotFoundError("Conversion not found");
  if (conversion.status !== "pending") throw new InvalidConversionTransitionError("Only a pending conversion can be approved");
  const updated = await affiliateRepository.updateConversionStatus(db, id, { status: "approved", approvedAt: new Date() });
  return updated!;
}

export async function markConversionPaid(id: string): Promise<ReferralConversion> {
  const conversion = await affiliateRepository.findConversionById(db, id);
  if (!conversion) throw new ConversionNotFoundError("Conversion not found");
  if (conversion.status !== "approved") throw new InvalidConversionTransitionError("Only an approved conversion can be marked paid");
  const updated = await affiliateRepository.updateConversionStatus(db, id, { status: "paid", paidAt: new Date() });
  return updated!;
}

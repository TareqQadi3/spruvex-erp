import { Router } from "express";
import { db, settingsTable, companiesTable, PERMISSIONS } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requirePermission, type AuthedRequest } from "../lib/auth-middleware";

const router = Router();

async function getOrCreateSettings(companyId: string) {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.companyId, companyId)).limit(1);
  if (rows.length === 0) {
    const [created] = await db.insert(settingsTable).values({ companyId }).returning();
    return created;
  }
  // Self-heal rows that picked up a blank value for a required/enum field from before
  // the PUT route rejected blanks (see `nonBlank` below) — otherwise they'd be stuck forever.
  const row = rows[0];
  const healed: Record<string, string> = {};
  if (!row.currency?.trim()) healed.currency = "SAR";
  if (!row.invoiceType?.trim()) healed.invoiceType = "a4";
  if (!row.repairInvoiceType?.trim()) healed.repairInvoiceType = "a4";
  if (!row.language?.trim()) healed.language = "en";
  if (!row.themeColor?.trim()) healed.themeColor = "blue";
  if (!row.shopName?.trim()) healed.shopName = "My Shop";
  if (Object.keys(healed).length === 0) return row;
  const [fixed] = await db.update(settingsTable).set(healed).where(eq(settingsTable.id, row.id)).returning();
  return fixed;
}

router.get("/", async (req: AuthedRequest, res) => {
  const settings = await getOrCreateSettings(req.user!.companyId);
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, req.user!.companyId)).limit(1);
  res.json({
    ...settings,
    companyName: company?.name,
    companyNameEn: company?.nameEn ?? null,
    businessType: company?.businessType ?? null,
  });
});

// Required, enum-like fields: never let an empty/blank string blank out a saved value.
// (Previously a stray "" payload for one of these would permanently stick, since
// downstream `?? default` checks only catch null/undefined, not "".)
function nonBlank(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

const BUSINESS_TYPES = new Set([
  "retail", "electronics", "repair", "restaurant", "ecommerce",
  "grocery", "cafe", "clothing", "other",
]);

router.put("/", requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req: AuthedRequest, res) => {
  const settings = await getOrCreateSettings(req.user!.companyId);
  const {
    shopName, shopAddress, shopPhone, currency, taxRate,
    lowStockThreshold, receiptFooter, language,
    logoUrl, invoiceHeaderText, invoiceFooterText, showBarcode, invoiceType,
    repairsModuleEnabled, vatNumber, themeColor,
    repairInvoiceType, repairInvoiceSameAsSales,
    openingBalance, fiscalYearStart, fiscalYearEnd, setupCompleted,
    posTemplate, companyNameEn, businessType,
  } = req.body;
  const currencyValue = nonBlank(currency);
  const languageValue = nonBlank(language);
  const invoiceTypeValue = nonBlank(invoiceType);
  const repairInvoiceTypeValue = nonBlank(repairInvoiceType);
  const themeColorValue = nonBlank(themeColor);
  const shopNameValue = nonBlank(shopName);
  const POS_TEMPLATES = new Set(["list", "grid", "image", "mobile"]);
  const posTemplateValue = typeof posTemplate === "string" && POS_TEMPLATES.has(posTemplate) ? posTemplate : undefined;
  const [updated] = await db.update(settingsTable).set({
    ...(shopNameValue !== undefined ? { shopName: shopNameValue } : {}),
    ...(shopAddress !== undefined ? { shopAddress } : {}),
    ...(shopPhone !== undefined ? { shopPhone } : {}),
    ...(currencyValue !== undefined ? { currency: currencyValue } : {}),
    ...(taxRate !== undefined ? { taxRate: taxRate.toString() } : {}),
    ...(lowStockThreshold !== undefined ? { lowStockThreshold } : {}),
    ...(receiptFooter !== undefined ? { receiptFooter } : {}),
    ...(languageValue !== undefined ? { language: languageValue } : {}),
    ...(logoUrl !== undefined ? { logoUrl } : {}),
    ...(invoiceHeaderText !== undefined ? { invoiceHeaderText } : {}),
    ...(invoiceFooterText !== undefined ? { invoiceFooterText } : {}),
    ...(showBarcode !== undefined ? { showBarcode } : {}),
    ...(invoiceTypeValue !== undefined ? { invoiceType: invoiceTypeValue } : {}),
    ...(repairsModuleEnabled !== undefined ? { repairsModuleEnabled } : {}),
    ...(vatNumber !== undefined ? { vatNumber } : {}),
    ...(themeColorValue !== undefined ? { themeColor: themeColorValue } : {}),
    ...(repairInvoiceTypeValue !== undefined ? { repairInvoiceType: repairInvoiceTypeValue } : {}),
    ...(repairInvoiceSameAsSales !== undefined ? { repairInvoiceSameAsSales } : {}),
    ...(openingBalance !== undefined ? { openingBalance: openingBalance.toString() } : {}),
    ...(fiscalYearStart !== undefined ? { fiscalYearStart } : {}),
    ...(fiscalYearEnd !== undefined ? { fiscalYearEnd } : {}),
    ...(setupCompleted !== undefined ? { setupCompleted } : {}),
    ...(posTemplateValue !== undefined ? { posTemplate: posTemplateValue } : {}),
  }).where(eq(settingsTable.id, settings.id)).returning();

  const companyNameEnValue = nonBlank(companyNameEn);
  const businessTypeValue = typeof businessType === "string" && BUSINESS_TYPES.has(businessType) ? businessType : undefined;
  if (companyNameEnValue !== undefined || businessTypeValue !== undefined) {
    await db.update(companiesTable).set({
      ...(companyNameEnValue !== undefined ? { nameEn: companyNameEnValue } : {}),
      ...(businessTypeValue !== undefined ? { businessType: businessTypeValue } : {}),
    }).where(eq(companiesTable.id, req.user!.companyId));
  }

  res.json(updated);
});

export default router;

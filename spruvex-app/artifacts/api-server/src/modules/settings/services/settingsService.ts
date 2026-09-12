import type { Settings } from "@workspace/db";
import { settingsRepository } from "../repositories/settingsRepository";
import type { DbClient } from "../../accounting/types";
import { resolveBusinessTypeDefaults } from "../../auth/services/businessTypeDefaults";
import type { BusinessType } from "../../auth/types/auth.types";

export async function getOrCreateSettings(db: DbClient, companyId: string): Promise<Settings> {
  const row = await settingsRepository.findByCompanyId(db, companyId);
  if (!row) return settingsRepository.insertDefault(db, companyId);

  // Self-heal rows that picked up a blank value for a required/enum field from before
  // the PUT route rejected blanks (see `nonBlank` below) — otherwise they'd be stuck forever.
  const healed: Record<string, string> = {};
  if (!row.currency?.trim()) healed.currency = "SAR";
  if (!row.invoiceType?.trim()) healed.invoiceType = "a4";
  if (!row.repairInvoiceType?.trim()) healed.repairInvoiceType = "a4";
  if (!row.language?.trim()) healed.language = "en";
  if (!row.themeColor?.trim()) healed.themeColor = "blue";
  if (!row.shopName?.trim()) healed.shopName = "My Shop";
  if (Object.keys(healed).length === 0) return row;
  return settingsRepository.update(db, row.id, healed);
}

export interface SettingsResponse extends Settings {
  companyName?: string;
  companyNameEn: string | null;
  businessType: string | null;
}

export async function buildSettingsResponse(db: DbClient, companyId: string): Promise<SettingsResponse> {
  const settings = await getOrCreateSettings(db, companyId);
  const company = await settingsRepository.findCompany(db, companyId);
  return {
    ...settings,
    companyName: company?.name,
    companyNameEn: company?.nameEn ?? null,
    businessType: company?.businessType ?? null,
  };
}

// Required, enum-like fields: never let an empty/blank string blank out a saved value.
// (Previously a stray "" payload for one of these would permanently stick, since
// downstream `?? default` checks only catch null/undefined, not "".)
function nonBlank(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

const BUSINESS_TYPES = new Set([
  "retail", "electronics", "repair", "restaurant", "ecommerce",
  "grocery", "cafe", "clothing", "mobile_repair", "contracting",
  "pharmacy", "salon_beauty", "other",
]);

const POS_TEMPLATES = new Set(["list", "grid", "image", "mobile"]);

export async function updateSettings(db: DbClient, companyId: string, body: Record<string, unknown>): Promise<Settings> {
  const settings = await getOrCreateSettings(db, companyId);
  const {
    shopName, shopAddress, shopPhone, currency, taxRate,
    lowStockThreshold, receiptFooter, language,
    logoUrl, invoiceHeaderText, invoiceFooterText, showBarcode, invoiceType,
    repairsModuleEnabled, vatNumber, themeColor,
    repairInvoiceType, repairInvoiceSameAsSales,
    openingBalance, fiscalYearStart, fiscalYearEnd, setupCompleted,
    posTemplate, companyNameEn, businessType, expiryAlertDays,
    posAutoReturnSeconds, posSuccessSoundEnabled,
  } = body as Record<string, any>;
  const currencyValue = nonBlank(currency);
  const languageValue = nonBlank(language);
  const invoiceTypeValue = nonBlank(invoiceType);
  const repairInvoiceTypeValue = nonBlank(repairInvoiceType);
  const themeColorValue = nonBlank(themeColor);
  const shopNameValue = nonBlank(shopName);
  const companyNameEnValue = nonBlank(companyNameEn);
  const businessTypeValue = typeof businessType === "string" && BUSINESS_TYPES.has(businessType) ? businessType : undefined;
  const posTemplateValue = typeof posTemplate === "string" && POS_TEMPLATES.has(posTemplate) ? posTemplate : undefined;

  // Changing the line of business must keep the module gates, module flags
  // and POS layout coherent with the newly-selected type — otherwise the
  // setup wizard's "other" default would silently override the signup choice
  // while enabledModules still describes the old business. Explicit values in
  // the same request always win over the recomputed defaults.
  const businessDefaults = businessTypeValue !== undefined ? resolveBusinessTypeDefaults(businessTypeValue as BusinessType) : null;
  const settingsPatch: Record<string, unknown> = {
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
    ...(expiryAlertDays !== undefined ? { expiryAlertDays: Number(expiryAlertDays) } : {}),
    ...(posAutoReturnSeconds !== undefined ? { posAutoReturnSeconds: Number(posAutoReturnSeconds) } : {}),
    ...(posSuccessSoundEnabled !== undefined ? { posSuccessSoundEnabled } : {}),
    ...(businessDefaults && repairsModuleEnabled === undefined ? { repairsModuleEnabled: businessDefaults.repairsModuleEnabled } : {}),
    ...(businessDefaults && body.ecommerceModuleEnabled === undefined ? { ecommerceModuleEnabled: businessDefaults.ecommerceModuleEnabled } : {}),
    ...(businessDefaults && posTemplateValue === undefined ? { posTemplate: businessDefaults.posTemplate } : {}),
  };
  // An empty SET clause is invalid SQL — a request that only touches company
  // fields (e.g. the setup wizard's business-type-only step) legitimately
  // sends nothing here, so just keep the row unchanged instead of updating.
  const updated = Object.keys(settingsPatch).length > 0
    ? await settingsRepository.update(db, settings.id, settingsPatch)
    : settings;

  const companyPatch: Record<string, string> = {};
  if (companyNameEnValue !== undefined) companyPatch.nameEn = companyNameEnValue;
  if (businessTypeValue !== undefined) {
    companyPatch.businessType = businessTypeValue;
    companyPatch.enabledModules = JSON.stringify(businessDefaults!.enabledModules);
  }
  if (Object.keys(companyPatch).length > 0) {
    await settingsRepository.updateCompany(db, companyId, companyPatch);
  }

  return updated;
}

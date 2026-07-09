/** Tenant-aware currency/number formatting. Defaults to SAR/ar-SA only when no setting is saved yet. */
export function formatCurrency(value: number | string, currency = "SAR", lang: "en" | "ar" = "ar"): string {
  const locale = lang === "ar" ? "ar-SA" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
}

export function formatNumber(value: number | string, lang: "en" | "ar" = "ar"): string {
  const locale = lang === "ar" ? "ar-SA" : "en-US";
  return new Intl.NumberFormat(locale).format(Number(value));
}

export function formatDate(value: Date | string, lang: "en" | "ar" = "ar"): string {
  const locale = lang === "ar" ? "ar-SA" : "en-US";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
}

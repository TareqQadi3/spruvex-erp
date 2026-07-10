// Domain-agnostic print/template types for the invoicing module. Designed to
// be reused by future SpruVex products (see lib/db/src/schema/invoiceTemplates.ts
// header comment) — nothing here is sales/purchase/restaurant-specific beyond
// the documentKind discriminator.

export interface PrintLine {
  name: string;
  quantity: number;
  unitPrice: string;
  discount: string;
  subtotal: string;
}

export interface PrintParty {
  name: string;
  vatNumber?: string | null;
  address?: string | null;
  phone?: string | null;
}

export interface PrintDocumentData {
  documentKind: "sales" | "purchase";
  documentType: string;
  documentTitleAr: string;
  documentTitleEn: string;
  documentNumber: string;
  issueDate: string;
  currency: string;
  seller: PrintParty;
  buyer?: PrintParty | null;
  lines: PrintLine[];
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  qrContent: string | null;
  relatedDocumentNumber?: string | null;
  notes?: string | null;
  isZatcaCompliant: boolean;
}

export type PrintType = "thermal_58" | "thermal_80" | "a4";

export interface TemplateConfig {
  showLogo: boolean;
  headerText?: string | null;
  footerText?: string | null;
  language: "ar" | "en";
  // hex like "#1a56db" — validate with /^#[0-9a-fA-F]{6}$/ before ever
  // interpolating into inline HTML/CSS; this is tenant-controlled config.
  accentColor: string;
  showBuyerInfo: boolean;
}

export const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
  showLogo: true,
  headerText: null,
  footerText: null,
  language: "ar",
  accentColor: "#1a56db",
  showBuyerInfo: true,
};

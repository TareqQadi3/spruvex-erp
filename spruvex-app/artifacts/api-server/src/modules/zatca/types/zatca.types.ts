export interface CreateInvoiceFromSaleInput {
  saleId: string;
  buyerName?: string;
  buyerVatNumber?: string;
}

export interface SubmitToZatcaInput {
  mode: "compliance_check" | "reporting" | "clearance";
}

export interface InvoiceLineForXml {
  productName: string;
  quantity: number;
  unitPrice: string;
  discount: string;
  subtotal: string;
}

export interface UblXmlContext {
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: string;
  zatcaUuid: string;
  issueDate: Date;
  currency: string;
  sellerName: string;
  sellerVatNumber: string | null;
  buyerName: string | null;
  buyerVatNumber: string | null;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  lines: InvoiceLineForXml[];
}

export interface ZatcaQrFields {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  total: string;
  taxAmount: string;
  signatureHash: string;
}

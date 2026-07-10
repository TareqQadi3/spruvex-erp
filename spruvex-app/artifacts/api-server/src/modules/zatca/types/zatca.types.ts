export interface CreateInvoiceFromSaleInput {
  saleId: string;
  buyerName?: string;
  buyerVatNumber?: string;
}

export interface CreateCreditNoteFromReturnInput {
  saleReturnId: string;
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
  // Set only for invoiceType credit_note/debit_note when the original invoice
  // it corrects is known — emits a <cac:BillingReference> block. Both null
  // means no BillingReference is emitted (e.g. original invoice not found).
  relatedInvoiceNumber?: string | null;
  relatedInvoiceZatcaUuid?: string | null;
}

export interface ZatcaQrFields {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  total: string;
  taxAmount: string;
  signatureHash: string;
}

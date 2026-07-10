import { withTransaction, type DbOrTx } from "../../../core/database/transaction";
import { AppError } from "../../../core/errors/AppError";
import { recordAuditEvent } from "../../../core/logging/auditLogger";
import { toCents, fromCents } from "../../../shared/utils/money";
import type { TenantContext } from "../../../shared/types/tenantContext";
import { InvoiceRepository } from "../repositories/invoiceRepository";
import { ZatcaLogRepository } from "../repositories/zatcaLogRepository";
import { generateUblXml } from "./xmlGenerator";
import { generateZatcaQr } from "./qrGenerator";
import { signInvoiceHash } from "./signingService";
import { assertContentMutable, assertTransition, type InvoiceStatus } from "./invoiceStateMachine";
import type {
  CreateCreditNoteFromReturnInput,
  CreateInvoiceFromSaleInput,
  InvoiceLineForXml,
  SubmitToZatcaInput,
} from "../types/zatca.types";

const invoiceRepo = new InvoiceRepository();
const logRepo = new ZatcaLogRepository();

const DEFAULT_TAX_RATE = 15; // KSA standard VAT rate, used if company has no settings row yet

function formatInvoiceNumber(sequence: number): string {
  return `INV-${String(sequence).padStart(6, "0")}`;
}

// A. createInvoiceFromSale — drafts an invoice from an already-completed sale.
// All amounts are derived from the sale record (itself server-computed by
// the POS engine) and the company's tax rate — nothing here is trusted from
// the request body except which sale to invoice and (optionally) buyer info.
export async function createInvoiceFromSale(tenant: TenantContext, input: CreateInvoiceFromSaleInput) {
  return withTransaction(async (tx) => {
    // Serializes invoice-number assignment for this company only.
    await invoiceRepo.lockCompanyForNumbering(tenant.companyId, tx);

    const sale = await invoiceRepo.findSaleById(tenant.companyId, input.saleId, tx);
    if (!sale) throw AppError.notFound("Sale not found");

    const existing = await invoiceRepo.findBySaleId(tenant.companyId, input.saleId, tx);
    if (existing) throw AppError.conflict(`Sale ${input.saleId} already has an invoice`);

    const company = await invoiceRepo.findCompanyById(tenant.companyId, tx);
    if (!company) throw AppError.internal("Company not found");
    const settings = await invoiceRepo.findSettings(tenant.companyId, tx);
    const taxRate = settings ? Number(settings.taxRate) : DEFAULT_TAX_RATE;

    // sale.total is treated as VAT-inclusive (standard KSA retail pricing) —
    // tax is backed out of it, not added on top.
    const totalCents = toCents(sale.total);
    const taxCents = Math.round(totalCents - totalCents / (1 + taxRate / 100));
    const subtotalCents = totalCents - taxCents;

    const sequence = (await invoiceRepo.countForCompany(tenant.companyId, tx)) + 1;

    const invoice = await invoiceRepo.create(
      {
        companyId: tenant.companyId,
        saleId: sale.id,
        invoiceNumber: formatInvoiceNumber(sequence),
        invoiceType: input.buyerVatNumber ? "standard" : "simplified",
        status: "draft",
        currency: settings?.currency ?? "SAR",
        subtotal: fromCents(subtotalCents),
        discountAmount: sale.discount,
        taxAmount: fromCents(taxCents),
        totalAmount: sale.total,
        sellerName: settings?.shopName ?? company.name,
        sellerVatNumber: settings?.vatNumber ?? null,
        buyerName: input.buyerName,
        buyerVatNumber: input.buyerVatNumber,
      },
      tx,
    );

    recordAuditEvent(tenant, {
      action: "create_invoice",
      entityType: "invoice",
      entityId: invoice.id,
      details: { saleId: sale.id, invoiceNumber: invoice.invoiceNumber },
    });

    return invoice;
  });
}

// A2. createCreditNoteFromReturn — drafts a credit_note invoice from a
// completed sale return. Mirrors createInvoiceFromSale's structure: amounts
// come from the return record (server-computed by the returns flow), not
// the request body — the request only says which return to credit-note.
export async function createCreditNoteFromReturn(tenant: TenantContext, input: CreateCreditNoteFromReturnInput) {
  return withTransaction(async (tx) => {
    // Serializes invoice-number assignment for this company only — credit
    // notes share the same numbering pool as sales invoices.
    await invoiceRepo.lockCompanyForNumbering(tenant.companyId, tx);

    const saleReturn = await invoiceRepo.findSaleReturnById(tenant.companyId, input.saleReturnId, tx);
    if (!saleReturn) throw AppError.notFound("Sale return not found");

    const existing = await invoiceRepo.findBySaleReturnId(tenant.companyId, input.saleReturnId, tx);
    if (existing) throw AppError.conflict(`Sale return ${input.saleReturnId} already has an invoice`);

    // Real ZATCA credit notes must reference an original invoice — the
    // original sale's invoice need not be signed/submitted yet (draft is
    // fine), it just has to exist.
    const originalInvoice = await invoiceRepo.findBySaleId(tenant.companyId, saleReturn.saleId, tx);
    if (!originalInvoice) {
      throw AppError.conflict("The original sale has no invoice yet — create one before issuing a credit note");
    }

    const company = await invoiceRepo.findCompanyById(tenant.companyId, tx);
    if (!company) throw AppError.internal("Company not found");
    const settings = await invoiceRepo.findSettings(tenant.companyId, tx);
    const taxRate = settings ? Number(settings.taxRate) : DEFAULT_TAX_RATE;

    // The credit note carries the positive magnitude of the refunded amount
    // (not netAmount — exchanges are netted separately at the sale-balance
    // level, not part of what ZATCA needs to see reversed here). Treated as
    // VAT-inclusive, same backing-out-tax math as createInvoiceFromSale.
    const totalCents = toCents(saleReturn.refundAmount);
    const taxCents = Math.round(totalCents - totalCents / (1 + taxRate / 100));
    const subtotalCents = totalCents - taxCents;

    const sequence = (await invoiceRepo.countForCompany(tenant.companyId, tx)) + 1;

    const invoice = await invoiceRepo.create(
      {
        companyId: tenant.companyId,
        saleId: saleReturn.saleId,
        saleReturnId: saleReturn.id,
        relatedInvoiceId: originalInvoice.id,
        invoiceNumber: formatInvoiceNumber(sequence),
        invoiceType: "credit_note",
        status: "draft",
        currency: settings?.currency ?? "SAR",
        subtotal: fromCents(subtotalCents),
        discountAmount: "0",
        taxAmount: fromCents(taxCents),
        totalAmount: fromCents(totalCents),
        sellerName: settings?.shopName ?? company.name,
        sellerVatNumber: settings?.vatNumber ?? null,
        // A return has no separate buyer capture — inherit from the original invoice.
        buyerName: originalInvoice.buyerName,
        buyerVatNumber: originalInvoice.buyerVatNumber,
      },
      tx,
    );

    recordAuditEvent(tenant, {
      action: "create_credit_note",
      entityType: "invoice",
      entityId: invoice.id,
      details: { saleReturnId: saleReturn.id, relatedInvoiceId: originalInvoice.id, invoiceNumber: invoice.invoiceNumber },
    });

    return invoice;
  });
}

// A2. getOrCreateInvoiceForSale — idempotent wrapper the POS "print invoice"
// action uses: most sales won't have an invoice yet (creation is optional and
// happens on-demand at print time), but a re-print of an already-invoiced
// sale must return the existing one rather than 409ing the UI.
export async function getOrCreateInvoiceForSale(tenant: TenantContext, saleId: string) {
  const existing = await invoiceRepo.findBySaleId(tenant.companyId, saleId);
  if (existing) return existing;
  return createInvoiceFromSale(tenant, { saleId });
}

// B. generateUBLXML — builds the UBL document and freezes the invoice
// content hash it will be signed against. Regenerable while still in
// draft/xml_generated (not yet signed).
export async function generateUBLXML(tenant: TenantContext, invoiceId: string) {
  return withTransaction(async (tx) => {
    const invoice = await invoiceRepo.findByIdForUpdate(tenant.companyId, invoiceId, tx);
    if (!invoice) throw AppError.notFound("Invoice not found");
    assertContentMutable(invoice.status as InvoiceStatus);

    // Credit notes source their lines from the return, not the original sale
    // — and exclude exchanged-in rows, which reverse nothing ZATCA-relevant.
    const lines: InvoiceLineForXml[] = invoice.saleReturnId
      ? (await invoiceRepo.findSaleReturnItems(tenant.companyId, invoice.saleReturnId, tx))
          .filter((item) => !item.isExchange)
          .map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: "0.00",
            subtotal: item.subtotal,
          }))
      : (await invoiceRepo.findSaleItems(tenant.companyId, invoice.saleId ?? "", tx)).map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          subtotal: item.subtotal,
        }));

    // For credit/debit notes, look up the original invoice being corrected
    // so the XML can carry a BillingReference back to it.
    const relatedInvoice = invoice.relatedInvoiceId
      ? await invoiceRepo.findById(tenant.companyId, invoice.relatedInvoiceId, tx)
      : null;

    const { xml, hash } = generateUblXml({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceType: invoice.invoiceType,
      zatcaUuid: invoice.zatcaUuid,
      issueDate: invoice.issueDate,
      currency: invoice.currency,
      sellerName: invoice.sellerName,
      sellerVatNumber: invoice.sellerVatNumber,
      buyerName: invoice.buyerName,
      buyerVatNumber: invoice.buyerVatNumber,
      subtotal: invoice.subtotal,
      discountAmount: invoice.discountAmount,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      lines,
      relatedInvoiceNumber: relatedInvoice?.invoiceNumber ?? null,
      relatedInvoiceZatcaUuid: relatedInvoice?.zatcaUuid ?? null,
    });

    // generateUblXml is a pure function of invoice + line items, and neither
    // can change once written (no update-invoice endpoint exists) — a second
    // call before signing is a deterministic no-op, so the existing row is
    // reused rather than rewritten with byte-identical content.
    const existingXml = await invoiceRepo.findXmlByInvoiceId(tenant.companyId, invoiceId, tx);
    const xmlRow = existingXml
      ? existingXml
      : await invoiceRepo.saveXml({ companyId: tenant.companyId, invoiceId, xmlContent: xml, xmlHash: hash }, tx);

    if (invoice.status === "draft") {
      assertTransition("draft", "xml_generated");
      await invoiceRepo.updateStatus(tenant.companyId, invoiceId, "xml_generated", tx);
    }

    recordAuditEvent(tenant, { action: "generate_xml", entityType: "invoice", entityId: invoiceId });

    return xmlRow;
  });
}

// D. signInvoice — freezes the invoice permanently. Must run after
// generateUBLXML (needs xml_hash) and before generateQRCode (needs the
// resulting signature hash) — see the module-level note on why the
// alphabetical A-E listing isn't the actual call order.
export async function signInvoice(tenant: TenantContext, invoiceId: string) {
  return withTransaction(async (tx) => {
    const invoice = await invoiceRepo.findByIdForUpdate(tenant.companyId, invoiceId, tx);
    if (!invoice) throw AppError.notFound("Invoice not found");
    assertTransition(invoice.status as InvoiceStatus, "signed");

    const xmlRow = await invoiceRepo.findXmlByInvoiceId(tenant.companyId, invoiceId, tx);
    if (!xmlRow) throw AppError.conflict("Invoice XML must be generated before signing");

    const lastSignature = await invoiceRepo.findLastSignature(tenant.companyId, tx);
    const signed = signInvoiceHash({
      xmlHash: xmlRow.xmlHash,
      previousInvoiceHash: lastSignature?.invoiceHash ?? null,
    });

    const signatureRow = await invoiceRepo.saveSignature(
      {
        companyId: tenant.companyId,
        invoiceId,
        previousInvoiceHash: signed.previousInvoiceHash,
        invoiceHash: signed.invoiceHash,
        signatureValue: signed.signatureValue,
        algorithm: signed.algorithm,
      },
      tx,
    );

    await invoiceRepo.updateStatus(tenant.companyId, invoiceId, "signed", tx);

    recordAuditEvent(tenant, {
      action: "sign_invoice",
      entityType: "invoice",
      entityId: invoiceId,
      details: { invoiceHash: signed.invoiceHash },
    });

    return signatureRow;
  });
}

// C. generateQRCode — requires a signature to already exist (its 6th TLV tag
// is the signature hash), so it runs after signInvoice in practice.
export async function generateQRCode(tenant: TenantContext, invoiceId: string) {
  return withTransaction(async (tx) => {
    const invoice = await invoiceRepo.findByIdForUpdate(tenant.companyId, invoiceId, tx);
    if (!invoice) throw AppError.notFound("Invoice not found");

    const signature = await invoiceRepo.findSignatureByInvoiceId(tenant.companyId, invoiceId, tx);
    if (!signature) throw AppError.conflict("Invoice must be signed before a QR code can be generated");

    const qrContent = generateZatcaQr({
      sellerName: invoice.sellerName,
      vatNumber: invoice.sellerVatNumber ?? "",
      timestamp: invoice.issueDate.toISOString(),
      total: invoice.totalAmount,
      taxAmount: invoice.taxAmount,
      signatureHash: signature.invoiceHash,
    });

    const qrRow = await invoiceRepo.saveQrCode({ companyId: tenant.companyId, invoiceId, qrContent }, tx);

    recordAuditEvent(tenant, { action: "generate_qr", entityType: "invoice", entityId: invoiceId });

    return qrRow;
  });
}

// E. submitToZATCA — STUB. See signingService.ts's header comment: no real
// ZATCA sandbox/production credentials or certificate exist in this
// environment, so this does not perform a real outbound call to ZATCA's API.
// It builds the same request shape a real integration would send, logs it,
// and simulates a response — the request/response logging and state
// transitions are real and exercised honestly; the network call is not.
export async function submitToZATCA(tenant: TenantContext, invoiceId: string, input: SubmitToZatcaInput) {
  return withTransaction(async (tx) => {
    const invoice = await invoiceRepo.findByIdForUpdate(tenant.companyId, invoiceId, tx);
    if (!invoice) throw AppError.notFound("Invoice not found");
    assertTransition(invoice.status as InvoiceStatus, "submitted");

    const signature = await invoiceRepo.findSignatureByInvoiceId(tenant.companyId, invoiceId, tx);
    if (!signature) throw AppError.conflict("Invoice must be signed before submission");

    const requestPayload = {
      mode: input.mode,
      invoiceUuid: invoice.zatcaUuid,
      invoiceHash: signature.invoiceHash,
      previousInvoiceHash: signature.previousInvoiceHash,
    };

    await invoiceRepo.updateStatus(tenant.companyId, invoiceId, "submitted", tx);
    await logRepo.record(
      tenant.companyId,
      { invoiceId, requestType: input.mode, status: "pending", requestPayload },
      tx,
    );

    // Simulated response — see header comment. A real integration replaces
    // this block with the actual ZATCA API call and parses its response to
    // decide accepted vs rejected instead of always succeeding.
    const responsePayload = { clearanceStatus: "CLEARED", validationResults: { status: "PASS" } };
    const httpStatusCode = 200;
    const finalStatus: InvoiceStatus = "accepted";

    assertTransition("submitted", finalStatus);
    await invoiceRepo.updateStatus(tenant.companyId, invoiceId, finalStatus, tx);

    const logRow = await logRepo.record(
      tenant.companyId,
      {
        invoiceId,
        requestType: input.mode,
        status: "success",
        httpStatusCode,
        requestPayload,
        responsePayload,
        respondedAt: new Date(),
      },
      tx,
    );

    recordAuditEvent(tenant, {
      action: "submit_zatca",
      entityType: "invoice",
      entityId: invoiceId,
      details: { mode: input.mode, result: finalStatus },
    });

    return { invoiceStatus: finalStatus, log: logRow };
  });
}

// Read-only detail view — invoice plus whatever xml/signature/qr/log rows
// exist so far in its lifecycle.
export async function getInvoiceDetail(companyId: string, invoiceId: string) {
  const invoice = await invoiceRepo.findById(companyId, invoiceId);
  if (!invoice) throw AppError.notFound("Invoice not found");

  const [xml, signature, logs] = await Promise.all([
    invoiceRepo.findXmlByInvoiceId(companyId, invoiceId),
    invoiceRepo.findSignatureByInvoiceId(companyId, invoiceId),
    logRepo.listForInvoice(companyId, invoiceId),
  ]);

  return { invoice, xml, signature, logs };
}

// F. getSalesPrintData — read-only contract function consumed by
// modules/invoicing for generic template/print rendering. No state
// mutation, no transaction: just assembles what's already on record.
const DOCUMENT_TITLES: Record<string, { ar: string; en: string }> = {
  simplified: { ar: "فاتورة ضريبية مبسطة", en: "Simplified Tax Invoice" },
  standard: { ar: "فاتورة ضريبية", en: "Tax Invoice" },
  credit_note: { ar: "إشعار دائن", en: "Credit Note" },
  debit_note: { ar: "إشعار مدين", en: "Debit Note" },
};

// Statuses at or after "signed" in the lifecycle — see invoiceStateMachine.ts.
const SIGNED_OR_LATER: ReadonlySet<InvoiceStatus> = new Set(["signed", "submitted", "accepted", "rejected"]);

export interface SalesPrintLine {
  name: string;
  quantity: number;
  unitPrice: string;
  discount: string;
  subtotal: string;
}

export interface SalesPrintData {
  documentKind: "sales";
  documentType: string; // invoice.invoiceType: simplified | standard | credit_note | debit_note
  documentTitleAr: string;
  documentTitleEn: string;
  documentNumber: string;
  issueDate: string; // ISO string
  currency: string;
  seller: { name: string; vatNumber: string | null };
  buyer: { name: string | null; vatNumber: string | null } | null;
  lines: SalesPrintLine[];
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  qrContent: string | null; // base64 TLV from qr_codes row; null if not generated yet
  relatedDocumentNumber: string | null; // original invoice's invoiceNumber, for credit/debit notes
  isZatcaCompliant: boolean; // true only when status is "signed" or later AND a qr_codes row exists
}

export async function getSalesPrintData(companyId: string, invoiceId: string): Promise<SalesPrintData> {
  const invoice = await invoiceRepo.findById(companyId, invoiceId);
  if (!invoice) throw AppError.notFound("Invoice not found");

  const [lines, qrRow, relatedInvoice] = await Promise.all([
    invoice.saleReturnId
      ? invoiceRepo
          .findSaleReturnItems(companyId, invoice.saleReturnId)
          .then((items) =>
            items
              .filter((item) => !item.isExchange)
              .map((item) => ({
                name: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: "0.00",
                subtotal: item.subtotal,
              })),
          )
      : invoiceRepo
          .findSaleItems(companyId, invoice.saleId ?? "")
          .then((items) =>
            items.map((item) => ({
              name: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              subtotal: item.subtotal,
            })),
          ),
    invoiceRepo.findQrByInvoiceId(companyId, invoiceId),
    invoice.relatedInvoiceId ? invoiceRepo.findById(companyId, invoice.relatedInvoiceId) : Promise.resolve(null),
  ]);

  const titles = DOCUMENT_TITLES[invoice.invoiceType] ?? DOCUMENT_TITLES.simplified;

  return {
    documentKind: "sales",
    documentType: invoice.invoiceType,
    documentTitleAr: titles.ar,
    documentTitleEn: titles.en,
    documentNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate.toISOString(),
    currency: invoice.currency,
    seller: { name: invoice.sellerName, vatNumber: invoice.sellerVatNumber },
    buyer: invoice.buyerName ? { name: invoice.buyerName, vatNumber: invoice.buyerVatNumber } : null,
    lines,
    subtotal: invoice.subtotal,
    discountAmount: invoice.discountAmount,
    taxAmount: invoice.taxAmount,
    totalAmount: invoice.totalAmount,
    qrContent: qrRow?.qrContent ?? null,
    relatedDocumentNumber: relatedInvoice?.invoiceNumber ?? null,
    isZatcaCompliant: SIGNED_OR_LATER.has(invoice.status as InvoiceStatus) && qrRow !== null,
  };
}

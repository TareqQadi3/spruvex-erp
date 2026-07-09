import { INVOICE_STATUSES, type InvoiceStatus } from "@workspace/db";
import { AppError } from "../../../core/errors/AppError";

export { INVOICE_STATUSES };
export type { InvoiceStatus };

// draft -> xml_generated -> signed -> submitted -> accepted | rejected
// accepted/rejected are terminal: a rejected or accepted invoice is never
// resubmitted in place — a correction is a new invoice (credit/debit note)
// linked via relatedInvoiceId, never a resurrection of this one.
const ALLOWED_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["xml_generated"],
  xml_generated: ["signed"],
  signed: ["submitted"],
  submitted: ["accepted", "rejected"],
  accepted: [],
  rejected: [],
};

export function assertTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw AppError.conflict(`Invalid invoice state transition: ${from} -> ${to}`);
  }
}

// Content (totals, buyer info, line-derived amounts) may only be (re)computed
// while still in draft or xml_generated — once signed, the signature's
// invoiceHash is a commitment to that exact content; changing it afterward
// would silently invalidate the signature without anyone noticing. Any
// correction after this point must be a credit/debit note, never an edit.
export function assertContentMutable(status: InvoiceStatus): void {
  if (status !== "draft" && status !== "xml_generated") {
    throw AppError.conflict(`Invoice content is immutable once ${status} — issue a credit/debit note instead`);
  }
}

import { describe, it, expect } from "vitest";
import { AppError } from "../../../core/errors/AppError";
import { assertTransition, assertContentMutable, INVOICE_STATUSES } from "./invoiceStateMachine";

// T-08: a full transition-matrix check of the invoice state machine on top of
// the existing invoiceStateMachine.unit.test.ts — locks every state against
// every target, not just the obvious happy-path/terminal pairs.
//
// draft -> xml_generated -> signed -> submitted -> accepted | rejected
// accepted/rejected are terminal (a correction is a new credit/debit note).

const ALLOWED: Record<string, string[]> = {
  draft: ["xml_generated"],
  xml_generated: ["signed"],
  signed: ["submitted"],
  submitted: ["accepted", "rejected"],
  accepted: [],
  rejected: [],
};

describe("invoiceStateMachine — full transition matrix", () => {
  it("allows exactly the forward transitions for every state", () => {
    for (const from of INVOICE_STATUSES) {
      for (const to of INVOICE_STATUSES) {
        if (ALLOWED[from].includes(to)) {
          expect(() => assertTransition(from, to), `expected ${from} -> ${to} to be allowed`).not.toThrow();
        } else {
          expect(() => assertTransition(from, to), `expected ${from} -> ${to} to be rejected`).toThrow();
        }
      }
    }
  });

  it("rejects every self-transition, including draft -> draft", () => {
    for (const status of INVOICE_STATUSES) {
      expect(() => assertTransition(status, status), `expected ${status} -> ${status} to be rejected`).toThrow();
    }
  });

  it("throws a 409 conflict for invalid transitions", () => {
    try {
      assertTransition("draft", "signed");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(409);
      expect((err as AppError).message).toContain("Invalid invoice state transition");
    }
  });

  it("content is mutable only before signing, for every state, and immutability is a 409 conflict", () => {
    for (const status of INVOICE_STATUSES) {
      if (status === "draft" || status === "xml_generated") {
        expect(() => assertContentMutable(status), `expected ${status} to be mutable`).not.toThrow();
      } else {
        expect(() => assertContentMutable(status), `expected ${status} to be immutable`).toThrow();
      }
    }

    try {
      assertContentMutable("signed");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(409);
    }
  });
});

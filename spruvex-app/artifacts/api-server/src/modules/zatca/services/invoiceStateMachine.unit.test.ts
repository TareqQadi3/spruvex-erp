import { describe, it, expect } from "vitest";
import { assertTransition, assertContentMutable } from "./invoiceStateMachine";

// Billing/ZATCA invoice lifecycle — the state machine guarding against ever
// resubmitting, re-signing, or silently mutating a signed invoice (a real
// compliance requirement, not just app hygiene).
describe("invoiceStateMachine (billing — ZATCA invoice lifecycle)", () => {
  describe("assertTransition", () => {
    it("allows every step of the real happy path", () => {
      expect(() => assertTransition("draft", "xml_generated")).not.toThrow();
      expect(() => assertTransition("xml_generated", "signed")).not.toThrow();
      expect(() => assertTransition("signed", "submitted")).not.toThrow();
      expect(() => assertTransition("submitted", "accepted")).not.toThrow();
    });

    it("allows submitted -> rejected as the alternate terminal outcome", () => {
      expect(() => assertTransition("submitted", "rejected")).not.toThrow();
    });

    it("rejects skipping a step (draft straight to signed)", () => {
      expect(() => assertTransition("draft", "signed")).toThrow(/Invalid invoice state transition/);
    });

    it("rejects any transition out of a terminal state", () => {
      expect(() => assertTransition("accepted", "submitted")).toThrow();
      expect(() => assertTransition("rejected", "submitted")).toThrow();
    });

    it("rejects resubmitting an already-submitted invoice", () => {
      expect(() => assertTransition("submitted", "submitted")).toThrow();
    });

    it("rejects going backwards (signed back to draft)", () => {
      expect(() => assertTransition("signed", "draft")).toThrow();
    });
  });

  describe("assertContentMutable", () => {
    it("allows content changes while draft or xml_generated", () => {
      expect(() => assertContentMutable("draft")).not.toThrow();
      expect(() => assertContentMutable("xml_generated")).not.toThrow();
    });

    it("blocks content changes once signed — the compliance-critical guarantee", () => {
      expect(() => assertContentMutable("signed")).toThrow(/immutable/);
      expect(() => assertContentMutable("submitted")).toThrow(/immutable/);
      expect(() => assertContentMutable("accepted")).toThrow(/immutable/);
      expect(() => assertContentMutable("rejected")).toThrow(/immutable/);
    });
  });
});

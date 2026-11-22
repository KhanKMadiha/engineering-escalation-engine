import { afterEach, describe, expect, it } from "vitest";
import {
  clearApprovalRationaleDraft,
  getApprovalRationaleDraft,
  resetApprovalRationaleDraftsForTests,
  setApprovalRationaleDraft,
} from "@/lib/ui/approval-rationale-draft";

afterEach(() => {
  resetApprovalRationaleDraftsForTests();
});

describe("approval rationale draft store", () => {
  it("preserves edits across simulated stage remounts for the same case", () => {
    const caseId = "ea1437f9-588f-418b-8222-c11079d246c2";
    const suggested =
      "SSO, production: A subset of users fail SAML authentication.";

    expect(getApprovalRationaleDraft(caseId)).toBeUndefined();

    const edited = `${suggested} Visitor-edited wording for Engineering.`;
    setApprovalRationaleDraft(caseId, edited);

    // Remount would call get + fall back to suggested only when undefined.
    expect(getApprovalRationaleDraft(caseId) ?? suggested).toBe(edited);
    expect(getApprovalRationaleDraft(caseId) ?? suggested).toBe(edited);
  });

  it("scopes drafts to the correct case id", () => {
    setApprovalRationaleDraft("case-a", "Draft for case A only.");
    setApprovalRationaleDraft("case-b", "Draft for case B only.");

    expect(getApprovalRationaleDraft("case-a")).toBe("Draft for case A only.");
    expect(getApprovalRationaleDraft("case-b")).toBe("Draft for case B only.");
    expect(getApprovalRationaleDraft("case-c")).toBeUndefined();
  });

  it("clears drafts after successful approval finalisation", () => {
    const caseId = "case-orchid";
    setApprovalRationaleDraft(caseId, "Approved rationale draft.");
    clearApprovalRationaleDraft(caseId);
    expect(getApprovalRationaleDraft(caseId)).toBeUndefined();
  });

  it("preserves empty and whitespace-only drafts exactly", () => {
    setApprovalRationaleDraft("case-a", "Temporary");
    setApprovalRationaleDraft("case-a", "");
    expect(getApprovalRationaleDraft("case-a")).toBe("");
    expect(getApprovalRationaleDraft("case-a")).not.toBeUndefined();

    setApprovalRationaleDraft("case-b", "   ");
    expect(getApprovalRationaleDraft("case-b")).toBe("   ");
  });
});

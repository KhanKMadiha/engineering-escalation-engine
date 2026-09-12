import { describe, expect, it } from "vitest";
import { validateSubmitHumanDecision } from "@/lib/cases/decision-validators";

const validCaseId = "11111111-1111-4111-8111-111111111111";

describe("validateSubmitHumanDecision", () => {
  it("accepts a valid decision payload", () => {
    const result = validateSubmitHumanDecision({
      caseId: validCaseId,
      decision: "approved",
      rationale: "Enough evidence to escalate to engineering.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.decidedBy).toBe("support_engineer");
    }
  });

  it("rejects missing rationale, invalid decision, and invalid case id", () => {
    const missing = validateSubmitHumanDecision({
      caseId: validCaseId,
      decision: "approved",
      rationale: "",
    });
    expect(missing.success).toBe(false);

    const invalid = validateSubmitHumanDecision({
      caseId: validCaseId,
      decision: "maybe",
      rationale: "Enough evidence to escalate to engineering.",
    });
    expect(invalid.success).toBe(false);

    const badId = validateSubmitHumanDecision({
      caseId: "not-a-uuid",
      decision: "approved",
      rationale: "Enough evidence to escalate to engineering.",
    });
    expect(badId.success).toBe(false);
  });
});

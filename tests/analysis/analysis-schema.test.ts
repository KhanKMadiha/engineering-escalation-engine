import { describe, expect, it } from "vitest";
import { parseCaseAnalysisResult } from "@/lib/analysis/analysis-schema";

const validAnalysis = {
  assessedSeverity: "high",
  issueCategory: "bug",
  reproducibility: "confirmed",
  suspectedProductDefect: true,
  reasoning: "Customer logs show gateway timeouts matching the reported behaviour.",
  evidenceIdentified: [
    {
      description: "Gateway timeout",
      sourceField: "logsErrors",
      quotedExcerpt: "gateway timeout upstream",
    },
  ],
  missingEvidence: ["HAR capture"],
  recommendedNextSteps: ["Collect additional request IDs"],
  suspectedRootCause: null,
  aiEscalationAssessment: "likely_continue",
};

describe("analysis schema", () => {
  it("accepts a valid structured response", () => {
    const result = parseCaseAnalysisResult(validAnalysis);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.issueCategory).toBe("bug");
      expect(result.data.suspectedRootCause).toBeNull();
    }
  });

  it("rejects an invalid enum", () => {
    const result = parseCaseAnalysisResult({
      ...validAnalysis,
      issueCategory: "network",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const withoutReasoning = { ...validAnalysis };
    delete (withoutReasoning as { reasoning?: string }).reasoning;
    const result = parseCaseAnalysisResult(withoutReasoning);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid evidence source field", () => {
    const result = parseCaseAnalysisResult({
      ...validAnalysis,
      evidenceIdentified: [
        {
          description: "Bad source",
          sourceField: "customerNotes",
          quotedExcerpt: "anything",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

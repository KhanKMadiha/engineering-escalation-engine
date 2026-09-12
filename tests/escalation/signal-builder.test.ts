import { describe, expect, it } from "vitest";
import type { CaseAnalysisResult } from "@/lib/analysis/analysis-schema";
import type { EvidenceValidationResult } from "@/lib/analysis/evidence-validator";
import { buildEscalationSignals } from "@/lib/escalation/signal-builder";
import type { SupportCase } from "@/types";

const supportCase: SupportCase = {
  id: "case-1",
  customer: "Acme Corp",
  product: "Payments API",
  severity: "high",
  issueTitle: "Checkout timeouts",
  issueDescription: "Customers report 504s during checkout.",
  environment: "production",
  stepsToReproduce: "",
  expectedBehaviour: "Checkout completes within 2 seconds.",
  actualBehaviour: "Requests time out after 30 seconds.",
  troubleshootingPerformed: "Checked gateway status page.",
  logsErrors: "ERROR gateway timeout upstream",
  requestIds: "req_abc123",
  incidentTimestamp: "2026-09-05T10:00:00.000Z",
  issueFirstObserved: null,
  affectedCustomerCount: 3,
  status: "awaiting_decision",
  createdAt: "2026-09-05T10:00:00.000Z",
  updatedAt: "2026-09-05T10:00:00.000Z",
};

const analysisResult: CaseAnalysisResult = {
  assessedSeverity: "critical",
  issueCategory: "bug",
  reproducibility: "confirmed",
  suspectedProductDefect: true,
  reasoning: "Logs show gateway timeouts.",
  evidenceIdentified: [
    {
      description: "Timeout",
      sourceField: "logsErrors",
      quotedExcerpt: "gateway timeout upstream",
    },
  ],
  missingEvidence: ["HAR capture"],
  recommendedNextSteps: ["Collect more request IDs"],
  suspectedRootCause: null,
  aiEscalationAssessment: "likely_escalate",
};

const validation: EvidenceValidationResult = {
  validatedEvidence: analysisResult.evidenceIdentified,
  rejectedEvidence: [],
  warnings: [],
  evidenceCompletenessScore: 0.5,
};

describe("buildEscalationSignals", () => {
  it("maps a valid case + validated analysis into expected signals", () => {
    const built = buildEscalationSignals(supportCase, {
      result: analysisResult,
      evidenceValidation: validation,
    });

    expect(built.reportedSeverity).toBe("high");
    expect(built.aiAssessedSeverity).toBe("critical");
    expect(built.environment).toBe("production");
    expect(built.affectedCustomerCount).toBe(3);
    expect(built.troubleshootingPerformed).toBe(true);
    expect(built.hasLogsOrErrors).toBe(true);
    expect(built.hasRequestIds).toBe(true);
    expect(built.hasIncidentTimestamp).toBe(true);
    expect(built.issueCategory).toBe("bug");
    expect(built.reproducibility).toBe("confirmed");
    expect(built.suspectedProductDefect).toBe(true);
    expect(built.evidenceCompletenessScore).toBe(0.5);
    expect(built.validatedEvidenceCount).toBe(1);
    expect(built.missingEvidenceCount).toBe(1);
    expect(built.configurationOrUserErrorIndicator).toBe(false);
  });

  it("treats missing optional case fields as null/false", () => {
    const built = buildEscalationSignals(
      {
        ...supportCase,
        affectedCustomerCount: null,
        incidentTimestamp: null,
        issueFirstObserved: null,
        troubleshootingPerformed: "   ",
        logsErrors: "",
        requestIds: "",
      },
      {
        result: analysisResult,
        evidenceValidation: validation,
      },
    );

    expect(built.affectedCustomerCount).toBeNull();
    expect(built.hasIncidentTimestamp).toBe(false);
    expect(built.troubleshootingPerformed).toBe(false);
    expect(built.hasLogsOrErrors).toBe(false);
    expect(built.hasRequestIds).toBe(false);
  });

  it("uses validated completeness only — unvalidated evidence cannot inflate completeness", () => {
    const withRejectedOnly: EvidenceValidationResult = {
      validatedEvidence: [],
      rejectedEvidence: [
        {
          description: "Invented",
          sourceField: "logsErrors",
          quotedExcerpt: "fabricated panic",
          reason: "not found",
        },
      ],
      warnings: ["Rejected unverifiable evidence"],
      evidenceCompletenessScore: 0,
    };

    const built = buildEscalationSignals(supportCase, {
      result: {
        ...analysisResult,
        evidenceIdentified: [],
      },
      evidenceValidation: withRejectedOnly,
    });

    expect(built.validatedEvidenceCount).toBe(0);
    expect(built.evidenceCompletenessScore).toBe(0);
  });

  it("derives configuration/user-error indicator deterministically", () => {
    const config = buildEscalationSignals(supportCase, {
      result: { ...analysisResult, issueCategory: "configuration" },
      evidenceValidation: validation,
    });
    const userError = buildEscalationSignals(supportCase, {
      result: { ...analysisResult, issueCategory: "user_error" },
      evidenceValidation: validation,
    });
    const bug = buildEscalationSignals(supportCase, {
      result: { ...analysisResult, issueCategory: "bug" },
      evidenceValidation: validation,
    });

    expect(config.configurationOrUserErrorIndicator).toBe(true);
    expect(userError.configurationOrUserErrorIndicator).toBe(true);
    expect(bug.configurationOrUserErrorIndicator).toBe(false);
  });
});

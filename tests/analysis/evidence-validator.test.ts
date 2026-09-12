import { describe, expect, it } from "vitest";
import {
  computeEvidenceCompletenessScore,
  fieldContainsExcerpt,
  validateEvidence,
} from "@/lib/analysis/evidence-validator";
import type { EvidenceIdentifiedItem } from "@/lib/analysis/analysis-schema";

const caseFields = {
  issueTitle: "Checkout timeouts",
  issueDescription: "Customers report 504s during checkout.",
  environment: "production" as const,
  stepsToReproduce: "",
  expectedBehaviour: "Checkout completes within 2 seconds.",
  actualBehaviour: "Requests time out after 30 seconds.",
  troubleshootingPerformed: "Checked gateway status page; no open incidents.",
  logsErrors: "ERROR gateway timeout upstream\nrequest failed with 504",
  requestIds: "req_abc123\nreq_def456",
};

describe("evidence validator", () => {
  it("accepts an exact valid excerpt", () => {
    const evidence: EvidenceIdentifiedItem[] = [
      {
        description: "Gateway timeout",
        sourceField: "logsErrors",
        quotedExcerpt: "ERROR gateway timeout upstream",
      },
    ];

    const result = validateEvidence(evidence, caseFields);
    expect(result.validatedEvidence).toHaveLength(1);
    expect(result.rejectedEvidence).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("accepts a valid excerpt with different whitespace", () => {
    const evidence: EvidenceIdentifiedItem[] = [
      {
        description: "Timeout line",
        sourceField: "logsErrors",
        quotedExcerpt: "ERROR   gateway\ntimeout   upstream",
      },
    ];

    expect(fieldContainsExcerpt(caseFields.logsErrors, evidence[0].quotedExcerpt)).toBe(
      true,
    );
    const result = validateEvidence(evidence, caseFields);
    expect(result.validatedEvidence).toHaveLength(1);
  });

  it("rejects an invalid excerpt", () => {
    const result = validateEvidence(
      [
        {
          description: "Invented log",
          sourceField: "logsErrors",
          quotedExcerpt: "FATAL kernel panic in payment-service",
        },
      ],
      caseFields,
    );

    expect(result.validatedEvidence).toHaveLength(0);
    expect(result.rejectedEvidence).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/Rejected unverifiable evidence/i);
  });

  it("rejects an excerpt from the wrong source field", () => {
    const result = validateEvidence(
      [
        {
          description: "Request ID in wrong field",
          sourceField: "issueDescription",
          quotedExcerpt: "req_abc123",
        },
      ],
      caseFields,
    );

    expect(result.validatedEvidence).toHaveLength(0);
    expect(result.rejectedEvidence[0]?.reason).toMatch(/not found/i);
  });

  it("rejects an empty excerpt", () => {
    const result = validateEvidence(
      [
        {
          description: "Blank",
          sourceField: "logsErrors",
          quotedExcerpt: "   ",
        },
      ],
      caseFields,
    );

    expect(result.validatedEvidence).toHaveLength(0);
    expect(result.rejectedEvidence[0]?.reason).toMatch(/Empty excerpt/i);
  });

  it("handles multiple evidence items correctly", () => {
    const result = validateEvidence(
      [
        {
          description: "Valid log",
          sourceField: "logsErrors",
          quotedExcerpt: "gateway timeout upstream",
        },
        {
          description: "Invented",
          sourceField: "logsErrors",
          quotedExcerpt: "stack trace from auth-module",
        },
        {
          description: "Valid request id",
          sourceField: "requestIds",
          quotedExcerpt: "req_abc123",
        },
      ],
      caseFields,
    );

    expect(result.validatedEvidence).toHaveLength(2);
    expect(result.rejectedEvidence).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
  });

  it("computes a deterministic evidence completeness score", () => {
    const validated: EvidenceIdentifiedItem[] = [
      {
        description: "Log",
        sourceField: "logsErrors",
        quotedExcerpt: "gateway timeout upstream",
      },
      {
        description: "Request",
        sourceField: "requestIds",
        quotedExcerpt: "req_abc123",
      },
    ];

    const scoreA = computeEvidenceCompletenessScore(caseFields, validated);
    const scoreB = computeEvidenceCompletenessScore(caseFields, validated);
    expect(scoreA).toBe(scoreB);
    expect(scoreA).toBeGreaterThan(0);
    expect(scoreA).toBeLessThanOrEqual(1);

    const emptyScore = computeEvidenceCompletenessScore(caseFields, []);
    expect(emptyScore).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { buildDraftEscalationRationale } from "@/lib/ui/escalation-approval-summary";
import type { CaseRecord, StoredAnalysis } from "@/types";

const analysis: StoredAnalysis = {
  id: "an-1",
  aiResult: {
    assessedSeverity: "high",
    issueCategory: "bug",
    reproducibility: "confirmed",
    suspectedProductDefect: true,
    reasoning: "Advisory",
    evidenceIdentified: [],
    missingEvidence: [],
    recommendedNextSteps: [],
    suspectedRootCause:
      "SAML assertion signature validation failing for a user cohort (inference; not proven).",
    aiEscalationAssessment: "likely_escalate",
  },
  validatedEvidence: [
    {
      description: "HTTP 401 in logs",
      sourceField: "logsErrors",
      quotedExcerpt: "HTTP status: 401",
    },
    {
      description: "Signature validation failed",
      sourceField: "logsErrors",
      quotedExcerpt: "Error: Signature validation failed",
    },
  ],
  rejectedEvidence: [],
  evidenceCompletenessScore: 0.9,
  analysisWarnings: [],
  model: "demo",
  promptVersion: "1",
  createdAt: "2026-06-25T12:50:00.000Z",
};

const record: CaseRecord = {
  id: "ea1437f9-588f-418b-8222-c11079d246c2",
  customer: "[DEMO] Orchid Health",
  product: "SSO",
  severity: "high",
  issueTitle: "[DEMO] SAML authentication fails for a subset of enterprise users",
  issueDescription: "A subset of enterprise users cannot complete SAML SSO.",
  environment: "production",
  stepsToReproduce: "1. Attempt SSO login",
  expectedBehaviour: "SSO succeeds",
  actualBehaviour:
    "A subset of users fail SAML authentication with signature validation errors while peers succeed.",
  troubleshootingPerformed: [
    "Reproduced the issue in production with an affected test user.",
    "Collected SAMLResponse excerpts showing Signature validation failed.",
  ].join("\n"),
  logsErrors: "HTTP status: 401",
  requestIds: "req-demo-saml-5520",
  incidentTimestamp: "2026-06-25T09:05:33.000Z",
  issueFirstObserved: "24 Jun 2026",
  affectedCustomerCount: 1,
  status: "awaiting_decision",
  createdAt: "2026-06-25T12:50:00.000Z",
  updatedAt: "2026-06-25T12:50:00.000Z",
  analysis,
  escalationResult: {
    escalationScore: 92,
    recommendation: "escalate",
    contributingFactors: [],
    recommendationReasons: ["Strong evidence"],
    source: "deterministic_engine",
  },
  events: [],
};

describe("buildDraftEscalationRationale", () => {
  it("drafts a concise reason without raw errors or hypotheses", () => {
    const rationale = buildDraftEscalationRationale(record);
    expect(rationale).toContain("SSO");
    expect(rationale).toContain("production");
    expect(rationale).toMatch(/Engineering involvement/i);
    expect(rationale).not.toContain("HTTP status: 401");
    expect(rationale).not.toContain("Hypothesis");
    expect(rationale).not.toContain("inference; not proven");
    expect(rationale).not.toContain("[DEMO]");
    expect(rationale.length).toBeLessThan(420);
  });
});

import { describe, expect, it } from "vitest";
import type { TechnicalEvidenceRecord } from "@/lib/evidence/evidence-types";
import {
  assessmentRecommendationHeadline,
  buildAssessmentEvidenceSection,
  buildAssessmentInvestigationSummary,
  buildAssessmentNextAction,
  buildAssessmentRecommendationDisplay,
  isAssessmentDiagnosticEvidence,
} from "@/lib/ui/assessment-summary";
import type {
  CaseRecord,
  EscalationEngineResult,
  EscalationHandoff,
  HumanDecision,
  StoredAnalysis,
} from "@/types";

function baseRecord(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: "b04a05d3-0000-4000-8000-000000000001",
    customer: "[DEMO] Vertex Media",
    product: "API Gateway",
    severity: "high",
    issueTitle: "[DEMO] Intermittent HTTP 504 gateway timeouts under peak load",
    issueDescription:
      "API Gateway intermittently returns HTTP 504 during peak traffic windows.",
    environment: "production",
    stepsToReproduce: "1. Issue requests during peak load.",
    expectedBehaviour: "HTTP 200",
    actualBehaviour: "Intermittent HTTP 504",
    troubleshootingPerformed: [
      "Reproduced the issue in production during a peak window.",
      "Collected gateway timeout logs with request IDs.",
      "Compared p95 latency for successful and failing requests.",
    ].join("\n"),
    logsErrors: "HTTP status: 504",
    requestIds: "req-demo-504-6618",
    incidentTimestamp: "2026-11-05T07:22:51.000Z",
    issueFirstObserved: null,
    affectedCustomerCount: 5,
    status: "awaiting_decision",
    createdAt: "2026-11-05T09:35:00.000Z",
    updatedAt: "2026-11-05T09:35:00.000Z",
    events: [],
    ...overrides,
  };
}

const escalateResult: EscalationEngineResult = {
  escalationScore: 100,
  recommendation: "escalate",
  contributingFactors: [
    {
      signal: "production_environment",
      weight: 25,
      direction: "increases",
      reason: "The reported issue is affecting a production environment.",
    },
  ],
  recommendationReasons: [
    "The issue has been reproduced in production and is supported by gateway timeout logs.",
  ],
  source: "deterministic_engine",
};

const evidenceItem: TechnicalEvidenceRecord = {
  id: "ev-1",
  caseId: "b04a05d3-0000-4000-8000-000000000001",
  evidenceType: "datadog_log",
  title: "[FICTIONAL DEMO] Gateway timeout logs",
  service: "api-gateway",
  body: "status=504",
  caption: null,
  capturedAt: "2026-11-05T07:22:51.000Z",
  requestId: "req-demo-504-6618",
  traceId: null,
  externalUrl: null,
  source: "demo_fictional",
  verificationStatus: "demo_fictional",
  sortOrder: 0,
  createdAt: "2026-11-05T09:35:00.000Z",
  updatedAt: "2026-11-05T09:35:00.000Z",
  attachments: [],
};

describe("assessment-summary", () => {
  it("builds investigation summary without request IDs or mid-sentence ellipsis", () => {
    const summary = buildAssessmentInvestigationSummary(
      baseRecord({
        issueDescription: [
          "API Gateway intermittently returns HTTP 504 during peak traffic windows.",
          "Upstream latency spikes correlate with failed requests.",
          "Request ID: req-demo-504-6618",
          "Timestamp: 2026-11-05T07:22:51Z",
        ].join("\n"),
      }),
    );
    expect(summary.overview).toContain("HTTP 504");
    expect(summary.overview).toContain("Upstream latency spikes");
    expect(summary.overview).not.toContain("Request ID");
    expect(summary.overview).not.toContain("Timestamp");
    expect(summary.overview).not.toContain("…");
    expect(summary.keyFindings).toHaveLength(3);
    expect(summary.keyFindings[0]).toContain("Reproduced the issue");
  });

  it("excludes observational customer notes from Assessment technical evidence", () => {
    const customerNote: TechnicalEvidenceRecord = {
      ...evidenceItem,
      id: "ev-note",
      evidenceType: "other",
      title: "[FICTIONAL DEMO] Customer note — Auto-Answer timeout",
      body: [
        "FICTIONAL DEMO — observational note only.",
        "Customer-provided note: Auto-Answer timeout in public channel.",
        "No complete webhook or bot-permission log package yet.",
      ].join("\n"),
    };
    expect(isAssessmentDiagnosticEvidence(customerNote)).toBe(false);
    expect(isAssessmentDiagnosticEvidence(evidenceItem)).toBe(true);

    const section = buildAssessmentEvidenceSection(
      baseRecord({
        status: "investigation_continues",
        escalationResult: {
          ...escalateResult,
          escalationScore: 58,
          recommendation: "continue_investigation",
        },
        analysis: {
          id: "an-continue",
          aiResult: {
            assessedSeverity: "high",
            issueCategory: "bug",
            reproducibility: "intermittent",
            suspectedProductDefect: false,
            reasoning: "Need webhook logs.",
            evidenceIdentified: [],
            missingEvidence: [
              "Complete Teams webhook / bot permission logs for a failing public channel.",
            ],
            recommendedNextSteps: [
              "Confirm bot membership in the failing public channel.",
            ],
            suspectedRootCause: null,
            aiEscalationAssessment: "likely_continue",
          },
          validatedEvidence: [],
          rejectedEvidence: [],
          evidenceCompletenessScore: 0.4,
          analysisWarnings: [],
          model: "demo",
          promptVersion: "1",
          createdAt: "2026-09-12T09:15:00.000Z",
        },
        technicalEvidence: [customerNote],
      }),
    );
    expect(section?.title).toBe("Further investigation required");
    expect(section?.evidenceItems).toHaveLength(0);
    expect(section?.gaps[0]).toContain("webhook");
  });

  it("labels recommendations in sentence case for Assessment", () => {
    expect(assessmentRecommendationHeadline("escalate")).toBe(
      "Escalate to Engineering",
    );
    expect(assessmentRecommendationHeadline("continue_investigation")).toBe(
      "Continue investigation",
    );
    expect(assessmentRecommendationHeadline("insufficient_evidence")).toBe(
      "Insufficient evidence",
    );
  });

  it("prefers Phase B technical evidence when present", () => {
    const section = buildAssessmentEvidenceSection(
      baseRecord({
        escalationResult: escalateResult,
        technicalEvidence: [evidenceItem],
      }),
    );
    expect(section?.title).toBe("Technical evidence");
    expect(section?.evidenceItems[0]?.label).toBe("Gateway timeout logs");
    expect(section?.evidenceItems[0]?.actionLabel).toBe("View logs");
  });

  it("shows Further investigation required for insufficient_evidence recommendations", () => {
    const analysis: StoredAnalysis = {
      id: "an-1",
      aiResult: {
        assessedSeverity: "medium",
        issueCategory: "configuration",
        reproducibility: "not_reproduced",
        suspectedProductDefect: false,
        reasoning: "Incomplete SAML package.",
        evidenceIdentified: [],
        missingEvidence: [
          "Complete SAML response / assertion for a failing login",
          "Application correlation IDs for failing SSO attempts",
        ],
        recommendedNextSteps: ["Collect a full SAML failure package."],
        suspectedRootCause: null,
        aiEscalationAssessment: "insufficient_data",
      },
      validatedEvidence: [],
      rejectedEvidence: [],
      evidenceCompletenessScore: 0.2,
      analysisWarnings: [],
      model: "demo",
      promptVersion: "1",
      createdAt: "2026-09-11T10:20:00.000Z",
    };

    const section = buildAssessmentEvidenceSection(
      baseRecord({
        status: "awaiting_decision",
        analysis,
        escalationResult: {
          ...escalateResult,
          escalationScore: 20,
          recommendation: "insufficient_evidence",
        },
        technicalEvidence: [evidenceItem],
      }),
    );

    expect(section?.title).toBe("Further investigation required");
    expect(section?.gaps[0]).toContain("SAML response");
    expect(section?.evidenceItems).toHaveLength(0);
  });

  it("prefers Further investigation required over Phase B when continuing investigation", () => {
    const section = buildAssessmentEvidenceSection(
      baseRecord({
        status: "investigation_continues",
        escalationResult: {
          ...escalateResult,
          escalationScore: 58,
          recommendation: "continue_investigation",
        },
        analysis: {
          id: "an-continue-gaps",
          aiResult: {
            assessedSeverity: "high",
            issueCategory: "bug",
            reproducibility: "intermittent",
            suspectedProductDefect: false,
            reasoning: "Need channel permission checks.",
            evidenceIdentified: [],
            missingEvidence: [
              "Complete Teams webhook / bot permission logs for a failing public channel",
            ],
            recommendedNextSteps: [
              "Confirm bot membership in the failing public channel.",
            ],
            suspectedRootCause: null,
            aiEscalationAssessment: "likely_continue",
          },
          validatedEvidence: [],
          rejectedEvidence: [],
          evidenceCompletenessScore: 0.4,
          analysisWarnings: [],
          model: "demo",
          promptVersion: "1",
          createdAt: "2026-09-12T09:15:00.000Z",
        },
        technicalEvidence: [evidenceItem],
      }),
    );
    expect(section?.title).toBe("Further investigation required");
    expect(section?.gaps[0]).toContain("webhook");
    expect(section?.evidenceItems).toHaveLength(0);
  });

  it("routes next action by recommendation without inventing integrations", () => {
    const awaiting = buildAssessmentNextAction(
      baseRecord({ escalationResult: escalateResult }),
    );
    expect(awaiting.actionLabel).toBe("Go to Escalation approval");
    expect(awaiting.targetStage).toBe("Escalation approval");

    const insufficient = buildAssessmentNextAction(
      baseRecord({
        escalationResult: {
          ...escalateResult,
          escalationScore: 20,
          recommendation: "insufficient_evidence",
        },
        analysis: {
          id: "an-insufficient",
          aiResult: {
            assessedSeverity: "medium",
            issueCategory: "configuration",
            reproducibility: "not_reproduced",
            suspectedProductDefect: false,
            reasoning: "Incomplete SAML package.",
            evidenceIdentified: [],
            missingEvidence: [
              "Complete SAML response / assertion for a failing login",
            ],
            recommendedNextSteps: ["Collect a full SAML failure package."],
            suspectedRootCause: null,
            aiEscalationAssessment: "insufficient_data",
          },
          validatedEvidence: [],
          rejectedEvidence: [],
          evidenceCompletenessScore: 0.2,
          analysisWarnings: [],
          model: "demo",
          promptVersion: "1",
          createdAt: "2026-09-11T10:20:00.000Z",
        },
      }),
    );
    expect(insufficient.actionLabel).toBe("Open Investigation");
    expect(insufficient.showNavigation).toBe(false);
    expect(insufficient.summary).toContain("Request");
    expect(insufficient.summary).toContain("authentication evidence");
    expect(insufficient.summary).toContain(
      "does not automatically update this assessment",
    );

    const decision: HumanDecision = {
      id: "d1",
      caseId: "b04a05d3-0000-4000-8000-000000000001",
      decision: "approved",
      rationale: "Ready for engineering.",
      decidedBy: "support_engineer",
      decidedAt: "2026-11-05T18:40:00.000Z",
      escalationScoreAtDecision: 100,
      recommendationAtDecision: "escalate",
      source: "human_decision",
    };

    const handoff: EscalationHandoff = {
      id: "h1",
      caseId: "b04a05d3-0000-4000-8000-000000000001",
      title: "Gateway timeouts",
      summary: "Handoff summary",
      customerImpact: "5 customers affected",
      environment: "production",
      reportedSeverity: "high",
      affectedCustomerCount: 5,
      issueCategory: "bug",
      stepsToReproduce: "steps",
      expectedBehaviour: "ok",
      actualBehaviour: "fail",
      evidence: [],
      missingEvidence: [],
      troubleshootingPerformed: "done",
      reproducibility: "confirmed",
      suspectedRootCause: "Not established",
      escalationScore: 100,
      escalationRecommendation: "escalate",
      decisionRationale: "Ready",
      createdAt: "2026-11-05T18:41:00.000Z",
      source: "engineering_handoff",
    };

    const approved = buildAssessmentNextAction(
      baseRecord({
        status: "escalated",
        escalationResult: escalateResult,
        decision,
        handoff,
      }),
    );
    expect(approved.actionLabel).toBe("Open Create escalation");
    expect(approved.summary).toContain("Escalation approved");
    expect(approved.summary).not.toMatch(/already created/i);

    const continueCase = buildAssessmentNextAction(
      baseRecord({
        status: "investigation_continues",
        analysis: {
          id: "an-2",
          aiResult: {
            assessedSeverity: "high",
            issueCategory: "bug",
            reproducibility: "intermittent",
            suspectedProductDefect: false,
            reasoning: "Permissions may still need checking.",
            evidenceIdentified: [],
            missingEvidence: ["Webhook delivery logs"],
            recommendedNextSteps: [
              "Confirm bot membership in the failing public channel.",
            ],
            suspectedRootCause: null,
            aiEscalationAssessment: "likely_continue",
          },
          validatedEvidence: [],
          rejectedEvidence: [],
          evidenceCompletenessScore: 0.5,
          analysisWarnings: [],
          model: "demo",
          promptVersion: "1",
          createdAt: "2026-09-12T09:15:00.000Z",
        },
        escalationResult: {
          ...escalateResult,
          escalationScore: 58,
          recommendation: "continue_investigation",
        },
      }),
    );
    expect(continueCase.targetStage).toBe("Investigation");
    expect(continueCase.actionLabel).toBe("Open Investigation");
    expect(continueCase.summary).toContain("bot membership");
    expect(continueCase.summary).toContain("support tickets");
  });

  it("keeps recommendation display grounded in deterministic explanation", () => {
    const display = buildAssessmentRecommendationDisplay(
      baseRecord({ escalationResult: escalateResult }),
    );
    expect(display?.headline).toBe("Escalate to Engineering");
    expect(display?.score).toBe(100);
    expect(display?.explanation).toContain("production");
  });
});

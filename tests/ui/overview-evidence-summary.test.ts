import { describe, expect, it } from "vitest";
import { buildOverviewEvidenceSummary } from "@/lib/ui/overview-evidence-summary";
import type { CaseRecord, StoredAnalysis } from "@/types";

const analysis: StoredAnalysis = {
  id: "an-1",
  aiResult: {
    assessedSeverity: "high",
    issueCategory: "bug",
    reproducibility: "intermittent",
    suspectedProductDefect: false,
    reasoning: "Continue investigating.",
    evidenceIdentified: [],
    missingEvidence: [
      "Complete Teams webhook logs",
      "Channel permission differential",
    ],
    recommendedNextSteps: [
      "Compare bot membership between public and private channels.",
    ],
    suspectedRootCause: null,
    aiEscalationAssessment: "likely_continue",
  },
  validatedEvidence: [
    {
      description: "Public channel Auto-Answer failures",
      sourceField: "actualBehaviour",
      quotedExcerpt: "fails to respond in public channels",
    },
  ],
  rejectedEvidence: [],
  evidenceCompletenessScore: 0.5,
  model: "demo",
  promptVersion: "1",
  createdAt: "2026-09-12T09:15:00.000Z",
};

const base: CaseRecord = {
  id: "33333333-3333-4333-8333-333333333333",
  customer: "[DEMO] Apex Digital",
  product: "MS Teams Integration",
  severity: "high",
  issueTitle: "[DEMO] MS Teams Auto-Answer fails",
  issueDescription: "Fails in public channels.",
  environment: "production",
  stepsToReproduce: "1. Trigger Auto-Answer",
  expectedBehaviour: "Responds",
  actualBehaviour: "Does not respond",
  troubleshootingPerformed: "Compared channels.",
  logsErrors: "Timeout note",
  requestIds: "teams-public-ch-pending",
  incidentTimestamp: null,
  issueFirstObserved: "11 Sep 2026",
  affectedCustomerCount: 1,
  status: "investigation_continues",
  createdAt: "2026-09-12T09:15:00.000Z",
  updatedAt: "2026-09-12T14:40:00.000Z",
  analysis,
  escalationResult: {
    escalationScore: 58,
    recommendation: "continue_investigation",
    contributingFactors: [
      {
        signal: "production_environment",
        weight: 25,
        direction: "increases",
        reason: "The reported issue is affecting a production environment.",
      },
    ],
    recommendationReasons: [
      "Deterministic score is 58/100 → continue investigation.",
      "Signals support further investigation before engineering escalation.",
    ],
    source: "deterministic_engine",
  },
  events: [],
};

describe("buildOverviewEvidenceSummary", () => {
  it("explains the recommendation without restating the score", () => {
    const summary = buildOverviewEvidenceSummary(base);
    expect(summary.recommendationExplanation).toContain(
      "further investigation",
    );
    expect(summary.recommendationExplanation).not.toMatch(/\d+\s*\/\s*100/);
    expect(summary.recommendationExplanation).toContain("webhook");
    expect(summary.nextAction.targetTab).toBe("investigation");
    expect(summary.nextAction.actionLabel).toBe("Open investigation");
  });

  it("points awaiting-decision cases at human review", () => {
    const summary = buildOverviewEvidenceSummary({
      ...base,
      status: "awaiting_decision",
      decision: undefined,
    });
    expect(summary.nextAction.targetTab).toBe("assessment");
    expect(summary.nextAction.title.toLowerCase()).toContain("approval");
    expect(summary.nextAction.summary.toLowerCase()).toContain(
      "escalation approval",
    );
  });

  it("points approved handoff cases at the handoff section", () => {
    const summary = buildOverviewEvidenceSummary({
      ...base,
      status: "escalated",
      decision: {
        id: "d1",
        caseId: base.id,
        decision: "approved",
        rationale: "Ready",
        decidedAt: "2026-09-12T15:00:00.000Z",
        decidedBy: "support_engineer",
        escalationScoreAtDecision: 58,
        recommendationAtDecision: "escalate",
        source: "human_decision",
      },
      handoff: {
        id: "h1",
        caseId: base.id,
        title: base.issueTitle,
        summary: base.issueDescription,
        customerImpact: "1",
        environment: "production",
        reportedSeverity: "high",
        affectedCustomerCount: 1,
        issueCategory: "unknown",
        stepsToReproduce: base.stepsToReproduce,
        expectedBehaviour: base.expectedBehaviour,
        actualBehaviour: base.actualBehaviour,
        reproducibility: "intermittent",
        troubleshootingPerformed: base.troubleshootingPerformed,
        evidence: [],
        missingEvidence: [],
        suspectedRootCause: "Unknown",
        escalationScore: 58,
        escalationRecommendation: "escalate",
        decisionRationale: "Ready",
        createdAt: "2026-09-12T15:00:00.000Z",
        source: "engineering_handoff",
      },
    });
    expect(summary.nextAction.targetTab).toBe("handoff");
    expect(summary.nextAction.title.toLowerCase()).toContain("create escalation");
  });
});

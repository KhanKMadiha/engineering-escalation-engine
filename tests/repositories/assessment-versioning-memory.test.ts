import { beforeEach, describe, expect, it } from "vitest";
import { createCaseEvent } from "@/lib/audit/case-events";
import { InMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
import {
  HandoffAlreadyExistsError,
  StaleAssessmentError,
} from "@/lib/repositories/persistence-errors";
import type {
  CreateCaseInput,
  EscalationEngineResult,
  EscalationHandoff,
  HumanDecision,
  StoredAnalysis,
} from "@/types";

const sampleInput: CreateCaseInput = {
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
  logsErrors: "gateway timeout upstream",
  requestIds: "req_abc123",
  incidentTimestamp: "2026-09-05T10:00:00.000Z",
  affectedCustomerCount: 3,
};

const baseAnalysis: StoredAnalysis = {
  id: "analysis-1",
  aiResult: {
    assessedSeverity: "high",
    issueCategory: "bug",
    reproducibility: "confirmed",
    suspectedProductDefect: true,
    reasoning: "Logs show gateway timeouts.",
    evidenceIdentified: [],
    missingEvidence: [],
    recommendedNextSteps: [],
    suspectedRootCause: null,
    aiEscalationAssessment: "likely_escalate",
  },
  validatedEvidence: [],
  rejectedEvidence: [],
  evidenceCompletenessScore: 0.8,
  model: "test-model",
  promptVersion: "v1",
  createdAt: "2026-09-06T10:00:00.000Z",
};

const baseEscalation: EscalationEngineResult = {
  escalationScore: 80,
  recommendation: "escalate",
  contributingFactors: [],
  recommendationReasons: ["Score supports escalation"],
  source: "deterministic_engine",
};

function decision(
  caseId: string,
  overrides: Partial<HumanDecision> = {},
): HumanDecision {
  return {
    id: crypto.randomUUID(),
    caseId,
    decision: "rejected",
    rationale: "Need more evidence before escalating to engineering.",
    decidedAt: "2026-09-06T11:00:00.000Z",
    decidedBy: "support_engineer",
    escalationScoreAtDecision: 80,
    recommendationAtDecision: "escalate",
    source: "human_decision",
    assessmentVersion: 1,
    isException: false,
    exceptionReason: null,
    ...overrides,
  };
}

describe("InMemoryCaseRepository assessment versioning", () => {
  let repo: InMemoryCaseRepository;

  beforeEach(() => {
    repo = new InMemoryCaseRepository();
  });

  it("versions analyses and preserves prior assessments", async () => {
    const created = await repo.createCase(sampleInput);
    await repo.saveAnalysis(created.id, baseAnalysis);
    await repo.saveEscalationResult(created.id, baseEscalation);

    let record = await repo.getCaseById(created.id);
    expect(record?.currentAssessmentVersion).toBe(1);
    expect(record?.analysis?.assessmentVersion).toBe(1);
    expect(record?.analysis?.isCurrent).toBe(true);
    expect(record?.escalationResult?.assessmentVersion).toBe(1);
    expect(record?.analysisHistory ?? []).toHaveLength(0);

    await repo.saveAnalysis(created.id, {
      ...baseAnalysis,
      id: "analysis-2",
      createdAt: "2026-09-07T10:00:00.000Z",
    });
    await repo.saveEscalationResult(created.id, {
      ...baseEscalation,
      escalationScore: 55,
      recommendation: "continue_investigation",
    });

    record = await repo.getCaseById(created.id);
    expect(record?.currentAssessmentVersion).toBe(2);
    expect(record?.analysis?.id).toBe("analysis-2");
    expect(record?.analysisHistory).toHaveLength(1);
    expect(record?.analysisHistory?.[0]?.assessmentVersion).toBe(1);
    expect(record?.analysisHistory?.[0]?.isCurrent).toBe(false);
    expect(record?.escalationHistory).toHaveLength(1);
    expect(record?.escalationResult?.escalationScore).toBe(55);
  });

  it("appends multiple human decisions and rejects stale assessment versions", async () => {
    const created = await repo.createCase(sampleInput);
    await repo.saveAnalysis(created.id, baseAnalysis);
    await repo.saveEscalationResult(created.id, baseEscalation);
    await repo.updateCaseStatus(created.id, "submitted");
    await repo.updateCaseStatus(created.id, "analyzing");
    await repo.updateCaseStatus(created.id, "awaiting_decision");

    await repo.persistDecisionOutcome({
      caseId: created.id,
      decision: decision(created.id),
      handoff: null,
      targetStatus: "investigation_continues",
      events: [
        createCaseEvent({
          caseId: created.id,
          eventType: "human_decision_recorded",
        }),
      ],
      expectedAssessmentVersion: 1,
    });

    let record = await repo.getCaseById(created.id);
    expect(record?.decisions).toHaveLength(1);
    expect(record?.status).toBe("investigation_continues");

    await repo.saveAnalysis(created.id, {
      ...baseAnalysis,
      id: "analysis-2",
    });
    await repo.saveEscalationResult(created.id, baseEscalation);

    await expect(
      repo.persistDecisionOutcome({
        caseId: created.id,
        decision: decision(created.id, {
          decision: "approved",
          assessmentVersion: 1,
          isException: true,
          exceptionReason:
            "Urgent customer outage requires escalation despite incomplete package.",
        }),
        handoff: null,
        targetStatus: "escalated",
        events: [],
        expectedAssessmentVersion: 1,
      }),
    ).rejects.toBeInstanceOf(StaleAssessmentError);

    const handoff: EscalationHandoff = {
      id: "h1",
      caseId: created.id,
      title: "Checkout timeouts",
      summary: "Handoff",
      customerImpact: "3 customers",
      environment: "production",
      reportedSeverity: "high",
      affectedCustomerCount: 3,
      issueCategory: "bug",
      stepsToReproduce: "steps",
      expectedBehaviour: "ok",
      actualBehaviour: "fail",
      evidence: [],
      missingEvidence: [],
      troubleshootingPerformed: "done",
      reproducibility: "confirmed",
      suspectedRootCause: "Not established",
      escalationScore: 80,
      escalationRecommendation: "escalate",
      decisionRationale: "Urgent exception",
      createdAt: "2026-09-07T12:00:00.000Z",
      source: "engineering_handoff",
    };

    await repo.persistDecisionOutcome({
      caseId: created.id,
      decision: decision(created.id, {
        decision: "approved",
        assessmentVersion: 2,
        isException: true,
        exceptionReason:
          "Urgent customer outage requires escalation despite incomplete package.",
      }),
      handoff,
      targetStatus: "escalated",
      events: [
        createCaseEvent({
          caseId: created.id,
          eventType: "engineering_handoff_created",
        }),
      ],
      expectedAssessmentVersion: 2,
    });

    record = await repo.getCaseById(created.id);
    expect(record?.decisions).toHaveLength(2);
    expect(record?.decision?.decision).toBe("approved");
    expect(record?.handoff?.id).toBe("h1");

    await expect(
      repo.persistDecisionOutcome({
        caseId: created.id,
        decision: decision(created.id, {
          decision: "approved",
          assessmentVersion: 2,
          isException: true,
          exceptionReason:
            "Urgent customer outage requires escalation despite incomplete package.",
        }),
        handoff: { ...handoff, id: "h2" },
        targetStatus: "escalated",
        events: [],
        expectedAssessmentVersion: 2,
      }),
    ).rejects.toBeInstanceOf(HandoffAlreadyExistsError);
  });
});

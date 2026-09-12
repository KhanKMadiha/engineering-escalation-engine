import { describe, expect, it } from "vitest";
import {
  analysisFromRow,
  analysisToRow,
  assembleCaseRecord,
  caseEventFromRow,
  caseEventToRow,
  escalationResultFromRow,
  escalationResultToRow,
  handoffFromRow,
  handoffToRow,
  humanDecisionFromRow,
  humanDecisionToRow,
  supportCaseFromRow,
  supportCaseToInsert,
} from "@/lib/supabase/mappers";
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
  logsErrors: "ERROR gateway timeout upstream",
  requestIds: "req_abc123",
  incidentTimestamp: "2026-09-05T10:00:00.000Z",
  issueFirstObserved: null,
  affectedCustomerCount: 3,
};

const analysis: StoredAnalysis = {
  id: "11111111-1111-4111-8111-111111111111",
  aiResult: {
    assessedSeverity: "high",
    issueCategory: "bug",
    reproducibility: "confirmed",
    suspectedProductDefect: true,
    reasoning: "Logs show gateway timeouts.",
    evidenceIdentified: [
      {
        description: "Timeout log",
        sourceField: "logsErrors",
        quotedExcerpt: "gateway timeout upstream",
      },
    ],
    missingEvidence: ["HAR capture"],
    recommendedNextSteps: ["Collect more logs"],
    suspectedRootCause: null,
    aiEscalationAssessment: "likely_escalate",
  },
  validatedEvidence: [
    {
      description: "Timeout log",
      sourceField: "logsErrors",
      quotedExcerpt: "gateway timeout upstream",
    },
  ],
  rejectedEvidence: [
    {
      description: "Invented",
      sourceField: "logsErrors",
      quotedExcerpt: "not in field",
      reason: "excerpt_not_found",
    },
  ],
  evidenceCompletenessScore: 0.5,
  provenance: {
    issueDescription: "customer_provided",
    assessedSeverity: "ai_inference",
  },
  analysisWarnings: ["partial evidence"],
  model: "test-model",
  promptVersion: "v1",
  createdAt: "2026-09-06T10:00:00.000Z",
};

const escalation: EscalationEngineResult = {
  escalationScore: 78,
  recommendation: "escalate",
  contributingFactors: [
    {
      signal: "production_environment",
      weight: 25,
      direction: "increases",
      reason: "Production impact",
    },
  ],
  recommendationReasons: ["Score supports escalation"],
  source: "deterministic_engine",
};

const decision: HumanDecision = {
  id: "22222222-2222-4222-8222-222222222222",
  caseId: "33333333-3333-4333-8333-333333333333",
  decision: "approved",
  rationale: "Reproducible in production with validated logs.",
  decidedAt: "2026-09-06T12:00:00.000Z",
  decidedBy: "support_engineer",
  escalationScoreAtDecision: 78,
  recommendationAtDecision: "escalate",
  source: "human_decision",
};

const handoff: EscalationHandoff = {
  id: "44444444-4444-4444-8444-444444444444",
  caseId: decision.caseId,
  title: "Checkout timeouts",
  summary: "Production checkout timeouts",
  customerImpact: "3 customers affected",
  environment: "production",
  reportedSeverity: "high",
  affectedCustomerCount: 3,
  issueCategory: "bug",
  stepsToReproduce: "1. Open checkout\n2. Submit payment",
  expectedBehaviour: "Checkout completes within 2 seconds.",
  actualBehaviour: "Requests time out after 30 seconds.",
  reproducibility: "confirmed",
  troubleshootingPerformed: "Checked gateway status page.",
  evidence: [
    {
      description: "Timeout log",
      sourceField: "logsErrors",
      quotedExcerpt: "gateway timeout upstream",
      source: "extracted_evidence",
    },
  ],
  missingEvidence: ["HAR capture"],
  suspectedRootCause: "Unknown",
  escalationScore: 78,
  escalationRecommendation: "escalate",
  decisionRationale: decision.rationale,
  createdAt: "2026-09-06T12:01:00.000Z",
  source: "engineering_handoff",
};

describe("Phase 7 repository mapping", () => {
  it("1–2. domain case maps to DB row and back", () => {
    const id = "33333333-3333-4333-8333-333333333333";
    const createdAt = "2026-09-06T09:00:00.000Z";
    const row = supportCaseToInsert(id, sampleInput, "draft", createdAt, createdAt);
    const domain = supportCaseFromRow(row);

    expect(domain.id).toBe(id);
    expect(domain.customer).toBe(sampleInput.customer);
    expect(domain.issueTitle).toBe(sampleInput.issueTitle);
    expect(domain.issueDescription).toBe(sampleInput.issueDescription);
    expect(domain.status).toBe("draft");
    expect(domain.incidentTimestamp).toBe(sampleInput.incidentTimestamp);
    expect(domain.issueFirstObserved).toBeNull();
    expect(domain.affectedCustomerCount).toBe(3);
    expect(row.issue_first_observed).toBeNull();
    expect(row.issue_title).toBe(sampleInput.issueTitle);
    expect(row.logs_errors).toBe(sampleInput.logsErrors);
  });

  it("3–4. structured fields and provenance round-trip", () => {
    const row = analysisToRow(decision.caseId, analysis);
    const back = analysisFromRow(row);

    expect(back.id).toBe(analysis.id);
    expect(back.aiResult).toEqual(analysis.aiResult);
    expect(back.validatedEvidence).toEqual(analysis.validatedEvidence);
    expect(back.rejectedEvidence).toEqual(analysis.rejectedEvidence);
    expect(back.provenance).toEqual(analysis.provenance);
    expect(back.analysisWarnings).toEqual(analysis.analysisWarnings);
    expect(back.evidenceCompletenessScore).toBe(0.5);
  });

  it("5–6. timestamps and IDs survive round-trip", () => {
    const decisionRow = humanDecisionToRow(decision);
    const decisionBack = humanDecisionFromRow(decisionRow);
    expect(decisionBack.id).toBe(decision.id);
    expect(decisionBack.caseId).toBe(decision.caseId);
    expect(decisionBack.decidedAt).toBe(decision.decidedAt);

    const handoffRow = handoffToRow(handoff);
    const handoffBack = handoffFromRow(handoffRow);
    expect(handoffBack.id).toBe(handoff.id);
    expect(handoffBack.createdAt).toBe(handoff.createdAt);
    expect(handoffBack.evidence).toEqual(handoff.evidence);

    const escRow = escalationResultToRow(decision.caseId, escalation, "esc-1");
    const escBack = escalationResultFromRow({
      ...escRow,
      created_at: "2026-09-06T11:00:00.000Z",
    });
    expect(escBack.escalationScore).toBe(78);
    expect(escBack.contributingFactors).toEqual(escalation.contributingFactors);

    const eventRow = caseEventToRow({
      id: "55555555-5555-4555-8555-555555555555",
      caseId: decision.caseId,
      eventType: "human_decision_recorded",
      metadata: { score: 78, recommendation: "escalate" },
      createdAt: "2026-09-06T12:00:00.000Z",
    });
    const eventBack = caseEventFromRow(eventRow);
    expect(eventBack.id).toBe(eventRow.id);
    expect(eventBack.metadata).toEqual({ score: 78, recommendation: "escalate" });
  });

  it("assembles a full CaseRecord without leaking snake_case fields", () => {
    const caseId = decision.caseId;
    const createdAt = "2026-09-06T09:00:00.000Z";
    const caseRow = supportCaseToInsert(
      caseId,
      sampleInput,
      "awaiting_decision",
      createdAt,
      createdAt,
    );
    const record = assembleCaseRecord({
      caseRow,
      analysis: analysisToRow(caseId, analysis),
      escalation: {
        ...escalationResultToRow(caseId, escalation, "esc-1"),
        created_at: createdAt,
      },
      decision: humanDecisionToRow(decision),
      handoff: handoffToRow(handoff),
      events: [
        caseEventToRow({
          id: "55555555-5555-4555-8555-555555555555",
          caseId,
          eventType: "case_created",
          createdAt,
        }),
      ],
    });

    expect(record.analysis?.provenance).toEqual(analysis.provenance);
    expect(record.escalationResult?.source).toBe("deterministic_engine");
    expect(record.decision?.source).toBe("human_decision");
    expect(record.handoff?.source).toBe("engineering_handoff");
    expect(record.events).toHaveLength(1);
    expect(record).not.toHaveProperty("issue_title");
  });
});

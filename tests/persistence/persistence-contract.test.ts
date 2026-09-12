import { beforeEach, describe, expect, it } from "vitest";
import { createCaseEvent } from "@/lib/audit/case-events";
import { DecisionService } from "@/lib/cases/decision-service";
import type { CaseRepository } from "@/lib/repositories/case-repository";
import { InMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
import { DuplicateDecisionError } from "@/lib/repositories/persistence-errors";
import type {
  CreateCaseInput,
  EscalationEngineResult,
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
  rejectedEvidence: [],
  evidenceCompletenessScore: 0.5,
  provenance: { issueDescription: "customer_provided" },
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

/**
 * Persistence contract tests run against InMemoryCaseRepository.
 * They verify the CaseRepository contract used by the application.
 * Live Supabase behaviour is covered separately (opt-in integration).
 */
describe("Phase 7 persistence contract (InMemory)", () => {
  let repo: CaseRepository & InMemoryCaseRepository;

  beforeEach(() => {
    repo = new InMemoryCaseRepository();
  });

  it("7–9. create / get / list cases", async () => {
    const created = await repo.createCase(sampleInput);
    const loaded = await repo.getCaseById(created.id);
    expect(loaded?.id).toBe(created.id);
    expect(loaded?.customer).toBe("Acme Corp");
    expect(loaded?.events.some((e) => e.eventType === "case_created")).toBe(
      true,
    );

    const listed = await repo.listCases();
    expect(listed.some((c) => c.id === created.id)).toBe(true);
  });

  it("10–11. analysis and escalation result persist", async () => {
    const created = await repo.createCase(sampleInput);
    await repo.saveAnalysis(created.id, analysis);
    await repo.saveEscalationResult(created.id, escalation);
    const loaded = await repo.getCaseWithDetails(created.id);
    expect(loaded?.analysis?.id).toBe(analysis.id);
    expect(loaded?.analysis?.provenance).toEqual(analysis.provenance);
    expect(loaded?.escalationResult?.escalationScore).toBe(78);
  });

  it("12–14. decision, handoff, and audit events persist", async () => {
    const created = await repo.createCase(sampleInput);
    await repo.saveAnalysis(created.id, analysis);
    await repo.saveEscalationResult(created.id, escalation);
    await repo.updateCaseStatus(created.id, "submitted");
    await repo.updateCaseStatus(created.id, "analyzing");
    await repo.updateCaseStatus(created.id, "awaiting_decision");

    const decision = {
      id: crypto.randomUUID(),
      caseId: created.id,
      decision: "approved" as const,
      rationale: "Reproducible in production with validated logs.",
      decidedAt: new Date().toISOString(),
      decidedBy: "support_engineer",
      escalationScoreAtDecision: 78,
      recommendationAtDecision: "escalate" as const,
      source: "human_decision" as const,
    };

    await repo.saveHumanDecision(created.id, decision);
    expect(await repo.getHumanDecision(created.id)).toMatchObject({
      id: decision.id,
      decision: "approved",
    });

    const handoff = {
      id: crypto.randomUUID(),
      caseId: created.id,
      title: created.issueTitle,
      summary: "summary",
      customerImpact: "impact",
      environment: "production",
      reportedSeverity: "high" as const,
      affectedCustomerCount: 3,
      issueCategory: "bug",
      stepsToReproduce: "",
      expectedBehaviour: "",
      actualBehaviour: "",
      reproducibility: "confirmed",
      troubleshootingPerformed: created.troubleshootingPerformed,
      evidence: [],
      missingEvidence: [],
      suspectedRootCause: "Unknown",
      escalationScore: 78,
      escalationRecommendation: "escalate" as const,
      decisionRationale: decision.rationale,
      createdAt: new Date().toISOString(),
      source: "engineering_handoff" as const,
    };
    await repo.saveEngineeringHandoff(created.id, handoff);
    expect(await repo.getEngineeringHandoff(created.id)).toMatchObject({
      id: handoff.id,
    });

    const event = createCaseEvent({
      caseId: created.id,
      eventType: "human_decision_recorded",
      metadata: { score: 78 },
    });
    await repo.appendEvent(created.id, event);
    const details = await repo.getCaseWithDetails(created.id);
    expect(
      details?.events.some((e) => e.eventType === "human_decision_recorded"),
    ).toBe(true);
  });

  it("15–18. invalid refs / duplicate decisions / domain invariants", async () => {
    await expect(
      repo.saveAnalysis("00000000-0000-4000-8000-000000000000", analysis),
    ).rejects.toThrow(/not found/i);

    const created = await repo.createCase(sampleInput);
    const decision = {
      id: crypto.randomUUID(),
      caseId: created.id,
      decision: "approved" as const,
      rationale: "Reproducible in production with validated logs.",
      decidedAt: new Date().toISOString(),
      decidedBy: "support_engineer",
      escalationScoreAtDecision: 78,
      recommendationAtDecision: "escalate" as const,
      source: "human_decision" as const,
    };
    await repo.saveHumanDecision(created.id, decision);
    await expect(repo.saveHumanDecision(created.id, decision)).rejects.toBeInstanceOf(
      DuplicateDecisionError,
    );

    await expect(
      repo.appendEvent(created.id, {
        id: crypto.randomUUID(),
        caseId: "other-case",
        eventType: "case_created",
        createdAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/does not match/i);
  });

  it("19–21. atomic approve / reject outcomes stay consistent", async () => {
    const created = await repo.createCase(sampleInput);
    await repo.saveAnalysis(created.id, analysis);
    await repo.saveEscalationResult(created.id, escalation);
    await repo.updateCaseStatus(created.id, "submitted");
    await repo.updateCaseStatus(created.id, "analyzing");
    await repo.updateCaseStatus(created.id, "awaiting_decision");

    const service = new DecisionService(repo);
    const approved = await service.recordDecision({
      caseId: created.id,
      decision: "approved",
      rationale: "Reproducible in production with validated logs.",
    });
    expect(approved.record.status).toBe("escalated");
    expect(approved.record.decision?.decision).toBe("approved");
    expect(approved.record.handoff).toBeDefined();

    const other = await repo.createCase({
      ...sampleInput,
      issueTitle: "Different issue",
    });
    await repo.saveAnalysis(other.id, analysis);
    await repo.saveEscalationResult(other.id, escalation);
    await repo.updateCaseStatus(other.id, "submitted");
    await repo.updateCaseStatus(other.id, "analyzing");
    await repo.updateCaseStatus(other.id, "awaiting_decision");

    const rejected = await service.recordDecision({
      caseId: other.id,
      decision: "rejected",
      rationale: "Need more request IDs before escalating.",
    });
    expect(rejected.record.status).toBe("investigation_continues");
    expect(rejected.record.handoff).toBeUndefined();
    expect(
      rejected.record.events.some(
        (e) => e.eventType === "engineering_handoff_created",
      ),
    ).toBe(false);
  });

  it("22. duplicate decision attempts cannot create two decisions", async () => {
    const created = await repo.createCase(sampleInput);
    await repo.saveAnalysis(created.id, analysis);
    await repo.saveEscalationResult(created.id, escalation);
    await repo.updateCaseStatus(created.id, "submitted");
    await repo.updateCaseStatus(created.id, "analyzing");
    await repo.updateCaseStatus(created.id, "awaiting_decision");

    const decision = {
      id: crypto.randomUUID(),
      caseId: created.id,
      decision: "approved" as const,
      rationale: "first",
      decidedAt: new Date().toISOString(),
      decidedBy: "support_engineer",
      escalationScoreAtDecision: 78,
      recommendationAtDecision: "escalate" as const,
      source: "human_decision" as const,
    };

    await repo.persistDecisionOutcome({
      caseId: created.id,
      decision,
      handoff: null,
      targetStatus: "investigation_continues",
      events: [
        createCaseEvent({
          caseId: created.id,
          eventType: "human_decision_recorded",
        }),
        createCaseEvent({
          caseId: created.id,
          eventType: "status_changed",
          metadata: { from: "awaiting_decision", to: "investigation_continues" },
        }),
      ],
    });

    await expect(
      repo.persistDecisionOutcome({
        caseId: created.id,
        decision: { ...decision, id: crypto.randomUUID() },
        handoff: null,
        targetStatus: "investigation_continues",
        events: [],
      }),
    ).rejects.toBeInstanceOf(DuplicateDecisionError);

    const loaded = await repo.getHumanDecision(created.id);
    expect(loaded?.id).toBe(decision.id);
  });
});

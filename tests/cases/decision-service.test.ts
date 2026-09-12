import { beforeEach, describe, expect, it } from "vitest";
import {
  DecisionAlreadyRecordedError,
  DecisionNotEligibleError,
  DecisionService,
  MissingEscalationResultError,
} from "@/lib/cases/decision-service";
import { InMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
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
  id: "analysis-1",
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

async function seedAwaitingDecision(repo: InMemoryCaseRepository) {
  const created = await repo.createCase(sampleInput);
  await repo.saveAnalysis(created.id, analysis);
  await repo.saveEscalationResult(created.id, escalation);
  await repo.updateCaseStatus(created.id, "submitted");
  await repo.updateCaseStatus(created.id, "analyzing");
  await repo.updateCaseStatus(created.id, "awaiting_decision");
  return created.id;
}

describe("DecisionService", () => {
  let repo: InMemoryCaseRepository;
  let service: DecisionService;

  beforeEach(() => {
    repo = new InMemoryCaseRepository();
    service = new DecisionService(repo);
  });

  it("1. approved decision transitions awaiting_decision → escalated", async () => {
    const caseId = await seedAwaitingDecision(repo);
    const result = await service.recordDecision({
      caseId,
      decision: "approved",
      rationale: "Reproducible in production with validated logs.",
    });
    expect(result.record.status).toBe("escalated");
  });

  it("2. rejected decision transitions awaiting_decision → investigation_continues", async () => {
    const caseId = await seedAwaitingDecision(repo);
    const result = await service.recordDecision({
      caseId,
      decision: "rejected",
      rationale: "Need more request IDs before escalating.",
    });
    expect(result.record.status).toBe("investigation_continues");
  });

  it("3. approval creates an engineering handoff", async () => {
    const caseId = await seedAwaitingDecision(repo);
    const result = await service.recordDecision({
      caseId,
      decision: "approved",
      rationale: "Reproducible in production with validated logs.",
    });
    expect(result.handoff).toBeDefined();
    expect(result.record.handoff?.source).toBe("engineering_handoff");
  });

  it("4. rejection does not create an engineering handoff", async () => {
    const caseId = await seedAwaitingDecision(repo);
    const result = await service.recordDecision({
      caseId,
      decision: "rejected",
      rationale: "Need more request IDs before escalating.",
    });
    expect(result.handoff).toBeUndefined();
    expect(result.record.handoff).toBeUndefined();
  });

  it("5. rationale is required", async () => {
    const caseId = await seedAwaitingDecision(repo);
    await expect(
      service.recordDecision({
        caseId,
        decision: "approved",
        rationale: "short",
      }),
    ).rejects.toBeInstanceOf(DecisionNotEligibleError);
  });

  it("6–8. decision records score, recommendation, and decidedBy", async () => {
    const caseId = await seedAwaitingDecision(repo);
    const result = await service.recordDecision({
      caseId,
      decision: "approved",
      rationale: "Reproducible in production with validated logs.",
    });
    expect(result.decision.escalationScoreAtDecision).toBe(78);
    expect(result.decision.recommendationAtDecision).toBe("escalate");
    expect(result.decision.decidedBy).toBe("support_engineer");
    expect(result.decision.source).toBe("human_decision");
  });

  it("9–10. decision and handoff create audit events", async () => {
    const caseId = await seedAwaitingDecision(repo);
    const result = await service.recordDecision({
      caseId,
      decision: "approved",
      rationale: "Reproducible in production with validated logs.",
    });
    const types = result.record.events.map((e) => e.eventType);
    expect(types).toContain("human_decision_recorded");
    expect(types).toContain("engineering_handoff_created");
  });

  it("11. decision cannot be submitted twice", async () => {
    const caseId = await seedAwaitingDecision(repo);
    await service.recordDecision({
      caseId,
      decision: "approved",
      rationale: "Reproducible in production with validated logs.",
    });
    await expect(
      service.recordDecision({
        caseId,
        decision: "rejected",
        rationale: "Changed my mind after the fact.",
      }),
    ).rejects.toBeInstanceOf(DecisionAlreadyRecordedError);
  });

  it("12. decision cannot be submitted when not awaiting_decision", async () => {
    const created = await repo.createCase(sampleInput);
    await expect(
      service.recordDecision({
        caseId: created.id,
        decision: "approved",
        rationale: "Trying to approve a draft case.",
      }),
    ).rejects.toBeInstanceOf(DecisionNotEligibleError);
  });

  it("13. decision cannot be submitted if escalation result is missing", async () => {
    const created = await repo.createCase(sampleInput);
    await repo.updateCaseStatus(created.id, "submitted");
    await repo.updateCaseStatus(created.id, "analyzing");
    await repo.updateCaseStatus(created.id, "awaiting_decision");
    await expect(
      service.recordDecision({
        caseId: created.id,
        decision: "approved",
        rationale: "No engine result exists for this case.",
      }),
    ).rejects.toBeInstanceOf(MissingEscalationResultError);
  });

  it("25–27. rejection is auditable without handoff event", async () => {
    const caseId = await seedAwaitingDecision(repo);
    const result = await service.recordDecision({
      caseId,
      decision: "rejected",
      rationale: "Need more request IDs before escalating.",
    });
    const types = result.record.events.map((e) => e.eventType);
    expect(types).toContain("human_decision_recorded");
    expect(types).not.toContain("engineering_handoff_created");
  });
});

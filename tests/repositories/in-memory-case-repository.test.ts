import { beforeEach, describe, expect, it } from "vitest";
import { createCaseEvent } from "@/lib/audit/case-events";
import { InMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
import type { CreateCaseInput } from "@/types";

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
  troubleshootingPerformed: "Checked gateway status page; no open incidents.",
  logsErrors: "gateway timeout upstream",
  requestIds: "req_abc123",
  incidentTimestamp: "2026-09-05T10:00:00.000Z",
  affectedCustomerCount: 3,
};

describe("InMemoryCaseRepository", () => {
  let repo: InMemoryCaseRepository;

  beforeEach(() => {
    repo = new InMemoryCaseRepository();
  });

  it("creates a case in draft status with a case_created event", async () => {
    const created = await repo.createCase(sampleInput);

    expect(created.id).toBeTruthy();
    expect(created.status).toBe("draft");
    expect(created.customer).toBe("Acme Corp");
    expect(created.affectedCustomerCount).toBe(3);

    const record = await repo.getCaseById(created.id);
    expect(record).not.toBeNull();
    expect(record!.events).toHaveLength(1);
    expect(record!.events[0].eventType).toBe("case_created");
  });

  it("lists cases newest-first and supports filters", async () => {
    const first = await repo.createCase(sampleInput);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await repo.createCase({
      ...sampleInput,
      customer: "Beta Inc",
      severity: "low",
    });
    await repo.updateCaseStatus(second.id, "submitted");

    const all = await repo.listCases();
    expect(all.map((c) => c.id)).toEqual([second.id, first.id]);
    expect(all[0].environment).toBe("production");
    expect(all[0].createdAt).toBeTruthy();

    const highOnly = await repo.listCases({ severity: "high" });
    expect(highOnly).toHaveLength(1);
    expect(highOnly[0].id).toBe(first.id);

    const submittedOnly = await repo.listCases({ status: "submitted" });
    expect(submittedOnly).toHaveLength(1);
    expect(submittedOnly[0].id).toBe(second.id);
  });

  it("updates status and appends a status_changed event", async () => {
    const created = await repo.createCase(sampleInput);
    await repo.updateCaseStatus(created.id, "submitted");

    const record = await repo.getCaseWithDetails(created.id);
    expect(record!.status).toBe("submitted");
    expect(record!.events.map((e) => e.eventType)).toEqual([
      "case_created",
      "status_changed",
    ]);
    expect(record!.events[1].metadata).toEqual({
      from: "draft",
      to: "submitted",
    });
  });

  it("persists analysis, escalation result, handoff, and decision", async () => {
    const created = await repo.createCase(sampleInput);
    const now = new Date().toISOString();

    await repo.saveAnalysis(created.id, {
      id: "analysis-1",
      aiResult: {
        assessedSeverity: "high",
        issueCategory: "bug",
        reproducibility: "confirmed",
        suspectedProductDefect: true,
        reasoning: "Timeouts align with gateway errors in logs.",
        evidenceIdentified: [],
        missingEvidence: [],
        recommendedNextSteps: ["Capture HAR file"],
        suspectedRootCause: null,
        aiEscalationAssessment: null,
      },
      validatedEvidence: [],
      rejectedEvidence: [],
      evidenceCompletenessScore: 0,
      model: "test-model",
      promptVersion: "v1",
      createdAt: now,
    });

    await repo.saveEscalationResult(created.id, {
      escalationScore: 75,
      recommendation: "escalate",
      contributingFactors: [],
      recommendationReasons: ["Production impact"],
      source: "deterministic_engine",
    });

    await repo.saveHandoff(created.id, {
      id: "handoff-1",
      caseId: created.id,
      title: "Checkout timeouts",
      summary: "Timeouts in checkout",
      customerImpact: "Customer: Acme Corp",
      environment: "production",
      reportedSeverity: "high",
      affectedCustomerCount: 3,
      issueCategory: "bug",
      stepsToReproduce: "1. Open checkout",
      expectedBehaviour: "Completes",
      actualBehaviour: "Times out",
      reproducibility: "confirmed",
      troubleshootingPerformed: "Checked gateway",
      evidence: [],
      missingEvidence: ["Not established"],
      suspectedRootCause: "Not established",
      escalationScore: 75,
      escalationRecommendation: "escalate",
      decisionRationale: "Matches prior incidents",
      createdAt: now,
      source: "engineering_handoff",
    });

    await repo.saveDecision(created.id, {
      id: "decision-1",
      caseId: created.id,
      decision: "approved",
      rationale: "Matches prior incidents",
      decidedAt: now,
      decidedBy: "support_engineer",
      escalationScoreAtDecision: 75,
      recommendationAtDecision: "escalate",
      source: "human_decision",
    });

    const record = await repo.getCaseWithDetails(created.id);
    expect(record!.analysis?.id).toBe("analysis-1");
    expect(record!.escalationResult?.recommendation).toBe("escalate");
    expect(record!.handoff?.id).toBe("handoff-1");
    expect(record!.decision?.decision).toBe("approved");

    const summaries = await repo.listCases();
    expect(summaries[0].escalationScore).toBe(75);
    expect(summaries[0].escalationRecommendation).toBe("escalate");
  });

  it("appends audit events and rejects mismatched case ids", async () => {
    const created = await repo.createCase(sampleInput);

    await repo.appendEvent(
      created.id,
      createCaseEvent({
        caseId: created.id,
        eventType: "case_submitted",
      }),
    );

    const record = await repo.getCaseById(created.id);
    expect(record!.events).toHaveLength(2);
    expect(record!.events[1].eventType).toBe("case_submitted");

    await expect(
      repo.appendEvent(
        created.id,
        createCaseEvent({
          caseId: "other-case",
          eventType: "analysis_started",
        }),
      ),
    ).rejects.toThrow(/does not match/);
  });

  it("throws when updating a missing case", async () => {
    await expect(
      repo.updateCaseStatus("missing-id", "submitted"),
    ).rejects.toThrow("Case not found: missing-id");
  });

  it("returns defensive copies so callers cannot mutate store state", async () => {
    const created = await repo.createCase(sampleInput);
    const record = await repo.getCaseById(created.id);
    record!.customer = "Mutated";
    record!.events.push(
      createCaseEvent({
        caseId: created.id,
        eventType: "analysis_failed",
      }),
    );

    const fresh = await repo.getCaseById(created.id);
    expect(fresh!.customer).toBe("Acme Corp");
    expect(fresh!.events).toHaveLength(1);
  });
});

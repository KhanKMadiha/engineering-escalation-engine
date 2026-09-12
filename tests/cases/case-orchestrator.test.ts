import { beforeEach, describe, expect, it } from "vitest";
import type { AnalysisModelClient } from "@/lib/analysis/analyze-case";
import { CaseOrchestrator } from "@/lib/cases/case-orchestrator";
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
  troubleshootingPerformed: "Checked gateway status page.",
  logsErrors: "ERROR gateway timeout upstream",
  requestIds: "req_abc123",
  incidentTimestamp: "2026-09-05T10:00:00.000Z",
  affectedCustomerCount: 3,
};

function mockClient(
  impl: AnalysisModelClient["generateAnalysis"],
): AnalysisModelClient {
  return {
    model: "mock-model",
    generateAnalysis: impl,
  };
}

function validAnalysisPayload() {
  return {
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
      {
        description: "Invented",
        sourceField: "logsErrors",
        quotedExcerpt: "fabricated stack trace",
      },
    ],
    missingEvidence: ["HAR"],
    recommendedNextSteps: ["Collect more logs"],
    suspectedRootCause: null,
    aiEscalationAssessment: "likely_continue",
  };
}

describe("CaseOrchestrator analysis pipeline", () => {
  let repo: InMemoryCaseRepository;

  beforeEach(() => {
    repo = new InMemoryCaseRepository();
  });

  it("runs analysis successfully, validates evidence, evaluates escalation, and audits", async () => {
    const created = await repo.createCase(sampleInput);
    const orchestrator = new CaseOrchestrator(
      repo,
      mockClient(async () => validAnalysisPayload()),
    );

    const result = await orchestrator.runAnalysisPipeline(created.id);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.record.status).toBe("awaiting_decision");
    expect(result.record.analysis).toBeDefined();
    expect(result.record.analysis?.validatedEvidence).toHaveLength(1);
    expect(result.record.analysis?.rejectedEvidence).toHaveLength(1);
    expect(result.record.analysis?.aiResult.evidenceIdentified).toHaveLength(1);
    expect(result.escalationResult.source).toBe("deterministic_engine");
    expect(result.record.escalationResult?.recommendation).toBe(
      result.escalationResult.recommendation,
    );
    expect(result.record.status).not.toBe("escalated");

    const eventTypes = result.record.events.map((event) => event.eventType);
    expect(eventTypes).toContain("analysis_started");
    expect(eventTypes).toContain("analysis_completed");
    expect(eventTypes).toContain("escalation_evaluated");
    expect(eventTypes).not.toContain("analysis_failed");
  });

  it("records analysis_failed and does not persist malformed AI output", async () => {
    const created = await repo.createCase(sampleInput);
    const orchestrator = new CaseOrchestrator(
      repo,
      mockClient(async () => ({ invalid: true })),
    );

    const result = await orchestrator.runAnalysisPipeline(created.id);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.errorCode).toBe("schema_invalid");
    expect(result.record?.analysis).toBeUndefined();
    expect(result.record?.status).toBe("submitted");
    expect(
      result.record?.events.some((event) => event.eventType === "analysis_failed"),
    ).toBe(true);
  });

  it("records analysis_failed on provider errors", async () => {
    const created = await repo.createCase(sampleInput);
    const orchestrator = new CaseOrchestrator(
      repo,
      mockClient(async () => {
        throw new Error("upstream unavailable");
      }),
    );

    const result = await orchestrator.runAnalysisPipeline(created.id);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.errorCode).toBe("provider_error");
    expect(result.record?.analysis).toBeUndefined();
    expect(
      result.record?.events.some((event) => event.eventType === "analysis_failed"),
    ).toBe(true);
  });
});

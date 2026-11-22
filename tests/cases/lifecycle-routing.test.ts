import { beforeEach, describe, expect, it } from "vitest";
import type { AnalysisModelClient } from "@/lib/analysis/analyze-case";
import { CaseOrchestrator } from "@/lib/cases/case-orchestrator";
import { DecisionService } from "@/lib/cases/decision-service";
import { statusAfterEscalationRecommendation } from "@/lib/cases/status-machine";
import { buildCaseQueueStats } from "@/lib/ui/case-queue-stats";
import { isWorkflowStageAvailable } from "@/lib/ui/case-workflow-stages";
import { InMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
import type { CreateCaseInput, SupportCaseSummary } from "@/types";

const escalateInput: CreateCaseInput = {
  customer: "Acme Corp",
  product: "Payments API",
  severity: "high",
  issueTitle: "Checkout timeouts",
  issueDescription: "Customers report 504s during checkout.",
  environment: "production",
  stepsToReproduce: "1. Checkout\n2. Observe timeout",
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

function escalatePayload() {
  return {
    assessedSeverity: "high" as const,
    issueCategory: "bug" as const,
    reproducibility: "confirmed" as const,
    suspectedProductDefect: true,
    reasoning: "Logs show gateway timeouts.",
    evidenceIdentified: [
      {
        description: "Timeout log",
        sourceField: "logsErrors" as const,
        quotedExcerpt: "gateway timeout upstream",
      },
    ],
    missingEvidence: [] as string[],
    recommendedNextSteps: ["Have a human reviewer approve escalation."],
    suspectedRootCause: null,
    aiEscalationAssessment: "likely_escalate" as const,
  };
}

function insufficientPayload() {
  return {
    assessedSeverity: "medium" as const,
    issueCategory: "configuration" as const,
    reproducibility: "not_reproduced" as const,
    suspectedProductDefect: false,
    reasoning: "Evidence incomplete after certificate rotation.",
    evidenceIdentified: [
      {
        description: "Partial note",
        sourceField: "logsErrors" as const,
        quotedExcerpt: "SSO authentication failed after certificate rotation",
      },
    ],
    missingEvidence: [
      "Complete SAML response",
      "Application correlation IDs",
      "Controlled reproduction",
    ],
    recommendedNextSteps: ["Collect a full SAML failure package."],
    suspectedRootCause: null,
    aiEscalationAssessment: "insufficient_data" as const,
  };
}

const insufficientInput: CreateCaseInput = {
  customer: "Meridian Systems",
  product: "SSO",
  severity: "medium",
  issueTitle: "SSO authentication fails after identity provider certificate rotation",
  issueDescription:
    "SSO authentication began failing for some users after an identity provider certificate rotation.",
  environment: "production",
  stepsToReproduce: "1. Attempt SSO login\n2. Observe failure",
  expectedBehaviour: "SSO authentication should succeed.",
  actualBehaviour:
    "SSO authentication fails for some users after the identity provider certificate rotation.",
  troubleshootingPerformed: "Confirmed the customer recently rotated the IdP signing certificate.",
  logsErrors:
    "Partial customer note: SSO authentication failed after certificate rotation. No complete application logs provided.",
  requestIds: "",
  incidentTimestamp: null,
  affectedCustomerCount: 1,
};

describe("Phase 1 lifecycle routing", () => {
  let repo: InMemoryCaseRepository;

  beforeEach(() => {
    repo = new InMemoryCaseRepository();
  });

  it("routes escalate recommendations to awaiting_decision without auto-escalating", async () => {
    const created = await repo.createCase(escalateInput);
    const orchestrator = new CaseOrchestrator(
      repo,
      mockClient(async () => escalatePayload()),
    );
    const result = await orchestrator.runAnalysisPipeline(created.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.escalationResult.recommendation).toBe("escalate");
    expect(result.record.status).toBe(
      statusAfterEscalationRecommendation("escalate"),
    );
    expect(result.record.status).toBe("awaiting_decision");
    expect(result.record.handoff).toBeUndefined();
    expect(isWorkflowStageAvailable("Escalation approval", result.record.status)).toBe(
      true,
    );
    expect(isWorkflowStageAvailable("Create escalation", result.record.status)).toBe(
      false,
    );
  });

  it("routes insufficient_evidence to investigation_continues without pending approval", async () => {
    const created = await repo.createCase(insufficientInput);
    const orchestrator = new CaseOrchestrator(
      repo,
      mockClient(async () => insufficientPayload()),
    );
    const result = await orchestrator.runAnalysisPipeline(created.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.escalationResult.recommendation).toBe("insufficient_evidence");
    expect(result.record.status).toBe("investigation_continues");
    expect(result.record.decision).toBeUndefined();
    expect(result.record.handoff).toBeUndefined();
    expect(isWorkflowStageAvailable("Escalation approval", result.record.status)).toBe(
      false,
    );
    expect(isWorkflowStageAvailable("Create escalation", result.record.status)).toBe(
      false,
    );
  });

  it("keeps Pending reviews count limited to awaiting_decision", async () => {
    const escalateCase = await repo.createCase({
      ...escalateInput,
      issueTitle: "Escalate me",
    });
    const continueCase = await repo.createCase({
      ...insufficientInput,
      issueTitle: "Investigate me",
    });
    await new CaseOrchestrator(
      repo,
      mockClient(async () => escalatePayload()),
    ).runAnalysisPipeline(escalateCase.id);
    await new CaseOrchestrator(
      repo,
      mockClient(async () => insufficientPayload()),
    ).runAnalysisPipeline(continueCase.id);

    const listed = await repo.listCases();
    const stats = buildCaseQueueStats(listed as SupportCaseSummary[]);
    expect(stats.awaitingReview).toBe(1);
    expect(
      listed.filter((item) => item.status === "awaiting_decision"),
    ).toHaveLength(1);
    expect(
      listed.filter((item) => item.status === "investigation_continues"),
    ).toHaveLength(1);
  });

  it("approval creates a single handoff and does not duplicate on re-submit", async () => {
    const created = await repo.createCase(escalateInput);
    const orchestrator = new CaseOrchestrator(
      repo,
      mockClient(async () => escalatePayload()),
    );
    const analyzed = await orchestrator.runAnalysisPipeline(created.id);
    expect(analyzed.ok).toBe(true);
    if (!analyzed.ok) return;

    const decisions = new DecisionService(repo);
    const approved = await decisions.recordDecision({
      caseId: created.id,
      decision: "approved",
      rationale: "Reproducible production timeout with validated gateway logs.",
    });
    expect(approved.record.status).toBe("escalated");
    expect(approved.handoff).toBeDefined();
    expect(isWorkflowStageAvailable("Create escalation", approved.record.status)).toBe(
      true,
    );

    await expect(
      decisions.recordDecision({
        caseId: created.id,
        decision: "approved",
        rationale: "Duplicate approval must be rejected by DecisionService.",
      }),
    ).rejects.toThrow(/already been recorded/i);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DecisionService } from "@/lib/cases/decision-service";
import { buildDemoWorkspaceExpiry } from "@/lib/demo/demo-workspace";
import {
  createDemoDownstreamRecord,
  DownstreamNotEligibleError,
} from "@/lib/demo/downstream-record-service";
import { ensureDemoWorkspaceForWrite } from "@/lib/demo/demo-workspace-session";
import { resolveWritableDemoCase } from "@/lib/demo/resolve-writable-demo-case";
import { InMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
import type {
  CreateCaseInput,
  DemoWorkspace,
  EscalationEngineResult,
  StoredAnalysis,
} from "@/types";

let activeWorkspace: DemoWorkspace | null = null;

vi.mock("@/lib/demo/demo-workspace-session", () => ({
  ensureDemoWorkspaceForWrite: vi.fn(async (repository: InMemoryCaseRepository) => {
    if (!activeWorkspace) {
      const workspace: DemoWorkspace = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        expiresAt: buildDemoWorkspaceExpiry(),
      };
      await repository.createDemoWorkspace(workspace);
      activeWorkspace = workspace;
      return { workspaceId: workspace.id, workspace, created: true };
    }
    return {
      workspaceId: activeWorkspace.id,
      workspace: activeWorkspace,
      created: false,
    };
  }),
  getOptionalDemoWorkspaceId: vi.fn(async () => activeWorkspace?.id ?? null),
}));

const analysis: StoredAnalysis = {
  id: "an-1",
  aiResult: {
    assessedSeverity: "high",
    issueCategory: "integration",
    reproducibility: "intermittent",
    suspectedProductDefect: true,
    reasoning: "Evidence supports escalation.",
    evidenceIdentified: [],
    missingEvidence: [],
    recommendedNextSteps: ["Approve escalation"],
    suspectedRootCause: null,
    aiEscalationAssessment: "likely_escalate",
  },
  validatedEvidence: [],
  rejectedEvidence: [],
  evidenceCompletenessScore: 0.9,
  model: "demo",
  promptVersion: "1",
  createdAt: "2026-06-25T13:00:00.000Z",
  assessmentVersion: 1,
  isCurrent: true,
};

const escalate: EscalationEngineResult = {
  escalationScore: 98,
  recommendation: "escalate",
  contributingFactors: [],
  recommendationReasons: ["Score supports escalation"],
  source: "deterministic_engine",
  assessmentVersion: 1,
  isCurrent: true,
};

async function seedCase(
  repo: InMemoryCaseRepository,
  input: CreateCaseInput,
  result: EscalationEngineResult,
  status: "awaiting_decision" | "investigation_continues",
) {
  const created = await repo.createCase(input);
  await repo.saveAnalysis(created.id, {
    ...analysis,
    id: crypto.randomUUID(),
  });
  await repo.saveEscalationResult(created.id, result);
  await repo.updateCaseStatus(created.id, "submitted");
  await repo.updateCaseStatus(created.id, "analyzing");
  await repo.updateCaseStatus(created.id, status);
  return created.id;
}

describe("Phase 2C visitor journeys (memory repository)", () => {
  let repo: InMemoryCaseRepository;
  let decisions: DecisionService;

  beforeEach(() => {
    repo = new InMemoryCaseRepository();
    decisions = new DecisionService(repo);
    activeWorkspace = null;
    vi.clearAllMocks();
  });

  it("Orchid: approve → fork → Jira+Rootly persist → no template mutation / no duplicates", async () => {
    const orchidId = await seedCase(
      repo,
      {
        customer: "[DEMO] Orchid Health",
        product: "SSO",
        severity: "high",
        issueTitle: "[DEMO] SAML SSO failing for some users",
        issueDescription:
          "Some users fail SAML SSO while peers on the same IdP succeed. Captured error: Signature validation failed (req-demo-saml-5520).",
        environment: "production",
        stepsToReproduce: "1. Attempt SSO",
        expectedBehaviour: "Login succeeds",
        actualBehaviour: "Login fails",
        troubleshootingPerformed: "Captured SAML error",
        logsErrors: "Signature validation failed",
        requestIds: "req-demo-saml-5520",
        incidentTimestamp: null,
        affectedCustomerCount: 3,
      },
      escalate,
      "awaiting_decision",
    );

    const session = await ensureDemoWorkspaceForWrite(repo);
    const writable = await resolveWritableDemoCase(orchidId, session.workspaceId, repo);
    expect(writable.record.id).not.toBe(orchidId);

    const approved = await decisions.recordDecision({
      caseId: writable.record.id,
      decision: "approved",
      rationale: "SAML signature failures warrant Engineering investigation.",
      decidedBy: "Demo Visitor",
      isSimulated: true,
    });
    expect(approved.record.status).toBe("escalated");
    expect(approved.handoff).toBeTruthy();

    const jira1 = await createDemoDownstreamRecord({
      caseId: writable.record.id,
      destination: "jira",
      repository: repo,
    });
    const jira2 = await createDemoDownstreamRecord({
      caseId: writable.record.id,
      destination: "jira",
      repository: repo,
    });
    expect(jira2.record.id).toBe(jira1.record.id);

    const rootly1 = await createDemoDownstreamRecord({
      caseId: writable.record.id,
      destination: "rootly",
      repository: repo,
    });
    const rootly2 = await createDemoDownstreamRecord({
      caseId: writable.record.id,
      destination: "rootly",
      repository: repo,
    });
    expect(rootly2.record.id).toBe(rootly1.record.id);

    const listed = await repo.listDemoDownstreamRecordsForCase!({
      workspaceId: session.workspaceId,
      caseId: writable.record.id,
    });
    expect(listed).toHaveLength(2);

    const template = await repo.getCaseById(orchidId);
    expect(template?.status).toBe("awaiting_decision");
    expect(template?.decision).toBeUndefined();
    expect(template?.handoff).toBeUndefined();
    expect(
      await repo.listDemoDownstreamRecordsForCase!({
        workspaceId: session.workspaceId,
        caseId: orchidId,
      }),
    ).toHaveLength(0);
  });

  it("Vertex: historical approval preserved on fork; corrected rationale; template unchanged", async () => {
    const vertexId = await seedCase(
      repo,
      {
        customer: "[DEMO] Vertex Media",
        product: "API Gateway",
        severity: "high",
        issueTitle: "[DEMO] Intermittent HTTP 504 Gateway Timeout Errors",
        issueDescription:
          "API requests intermittently return HTTP 504 errors in prod.",
        environment: "production",
        stepsToReproduce: "1. Issue requests",
        expectedBehaviour: "HTTP 200",
        actualBehaviour:
          "Requests intermittently return HTTP 504 with elevated upstream latency.",
        troubleshootingPerformed: "Reproduced in production.",
        logsErrors: "upstream_duration_ms: 30112",
        requestIds: "req-demo-504-6618",
        incidentTimestamp: "2026-11-05T07:22:51.000Z",
        affectedCustomerCount: 5,
      },
      { ...escalate, escalationScore: 100 },
      "awaiting_decision",
    );

    const rationale =
      "HTTP 504 gateway timeouts were reproduced in production, affecting multiple customer accounts. Request IDs and gateway logs were captured during troubleshooting. Engineering investigation is required to determine the underlying cause.";
    await decisions.recordDecision({
      caseId: vertexId,
      decision: "approved",
      rationale,
      decidedBy: "Support Lead",
      isSimulated: false,
    });

    const before = await repo.getCaseById(vertexId);
    expect(before?.decision?.rationale).toBe(rationale);
    expect(before?.handoff?.decisionRationale).toBe(rationale);

    await ensureDemoWorkspaceForWrite(repo);
    const jira = await createDemoDownstreamRecord({
      caseId: vertexId,
      destination: "jira",
      repository: repo,
    });
    expect(jira.redirectedFromTemplate).toBe(true);
    expect(jira.caseRecord.decision?.decidedBy).toBe("Support Lead");
    expect(jira.caseRecord.decision?.isSimulated).toBe(false);
    expect(jira.caseRecord.decision?.rationale).toBe(rationale);
    expect(jira.caseRecord.handoff?.decisionRationale).toBe(rationale);

    const rootly = await createDemoDownstreamRecord({
      caseId: jira.caseRecord.id,
      destination: "rootly",
      repository: repo,
    });
    expect(rootly.caseRecord.id).toBe(jira.caseRecord.id);

    const template = await repo.getCaseById(vertexId);
    expect(template?.decision?.id).toBe(before?.decision?.id);
    expect(template?.handoff?.id).toBe(before?.handoff?.id);
    expect(template?.decision?.rationale).toBe(rationale);
  });

  it("Meridian: blocks approval and downstream without creating a workspace when none exists", async () => {
    const meridianId = await seedCase(
      repo,
      {
        customer: "[DEMO] Meridian Systems",
        product: "SSO",
        severity: "medium",
        issueTitle:
          "[DEMO] SSO login fails for some users after IdP certificate rotation",
        issueDescription:
          "Some users cannot log in via SSO after an IdP certificate rotation. Still waiting for complete SAML error details.",
        environment: "production",
        stepsToReproduce: "1. Attempt SSO",
        expectedBehaviour: "Login succeeds",
        actualBehaviour: "SSO login fails for some users",
        troubleshootingPerformed: "Still waiting for SAML details",
        logsErrors: "Partial note",
        requestIds: "none",
        incidentTimestamp: null,
        affectedCustomerCount: 1,
      },
      {
        ...escalate,
        escalationScore: 20,
        recommendation: "insufficient_evidence",
      },
      "investigation_continues",
    );

    const record = await repo.getCaseById(meridianId);
    expect(record?.escalationResult?.recommendation).toBe(
      "insufficient_evidence",
    );
    expect(record?.status).toBe("investigation_continues");

    // Soft eligibility: DecisionService rejects without needing a fork.
    await expect(
      decisions.recordDecision({
        caseId: meridianId,
        decision: "approved",
        rationale: "Should not be allowed for insufficient evidence.",
      }),
    ).rejects.toThrow(/not awaiting a human decision|recommends escalation/i);

    await expect(
      createDemoDownstreamRecord({
        caseId: meridianId,
        destination: "jira",
        repository: repo,
      }),
    ).rejects.toBeInstanceOf(DownstreamNotEligibleError);

    // Service throws before ensureDemoWorkspaceForWrite — no private workspace/fork.
    expect(ensureDemoWorkspaceForWrite).not.toHaveBeenCalled();
    expect(activeWorkspace).toBeNull();
    expect(repo.size()).toBe(1); // template only
  });
});

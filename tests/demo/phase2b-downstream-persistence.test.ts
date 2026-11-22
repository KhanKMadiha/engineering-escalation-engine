import { beforeEach, describe, expect, it, vi } from "vitest";
import { DecisionService } from "@/lib/cases/decision-service";
import { buildDemoWorkspaceExpiry } from "@/lib/demo/demo-workspace";
import {
  createDemoDownstreamRecord,
  DownstreamNotEligibleError,
} from "@/lib/demo/downstream-record-service";
import { InMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
import type {
  CreateCaseInput,
  DemoWorkspace,
  EscalationEngineResult,
  StoredAnalysis,
} from "@/types";

let activeWorkspace: DemoWorkspace | null = null;

vi.mock("@/lib/demo/demo-workspace-session", () => ({
  ensureDemoWorkspaceForWrite: vi.fn(async () => {
    if (!activeWorkspace) {
      throw new Error("Test must set activeWorkspace before create");
    }
    return {
      workspaceId: activeWorkspace.id,
      workspace: activeWorkspace,
      created: false,
    };
  }),
  getOptionalDemoWorkspaceId: vi.fn(async () => activeWorkspace?.id ?? null),
}));

const orchidInput: CreateCaseInput = {
  customer: "[DEMO] Orchid Health",
  product: "SSO",
  severity: "high",
  issueTitle: "[DEMO] SAML SSO failing for some users",
  issueDescription: "Some users fail SAML SSO.",
  environment: "production",
  stepsToReproduce: "1. Attempt SSO",
  expectedBehaviour: "Login succeeds",
  actualBehaviour: "Login fails",
  troubleshootingPerformed: "Captured SAML error",
  logsErrors: "Signature validation failed",
  requestIds: "req-demo-saml-5520",
  incidentTimestamp: null,
  affectedCustomerCount: 3,
};

const analysis: StoredAnalysis = {
  id: "an-1",
  aiResult: {
    assessedSeverity: "high",
    issueCategory: "integration",
    reproducibility: "intermittent",
    suspectedProductDefect: true,
    reasoning: "SAML signature failures.",
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

const escalateResult: EscalationEngineResult = {
  escalationScore: 98,
  recommendation: "escalate",
  contributingFactors: [],
  recommendationReasons: ["Score supports escalation"],
  source: "deterministic_engine",
  assessmentVersion: 1,
  isCurrent: true,
};

describe("Phase 2B simulated downstream persistence", () => {
  let repo: InMemoryCaseRepository;
  let decisions: DecisionService;

  beforeEach(() => {
    repo = new InMemoryCaseRepository();
    decisions = new DecisionService(repo);
    activeWorkspace = null;
    vi.clearAllMocks();
  });

  async function createWorkspace() {
    const workspace: DemoWorkspace = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: buildDemoWorkspaceExpiry(),
    };
    await repo.createDemoWorkspace(workspace);
    activeWorkspace = workspace;
    return workspace;
  }

  async function seedOrchidAwaiting() {
    const created = await repo.createCase(orchidInput);
    await repo.saveAnalysis(created.id, analysis);
    await repo.saveEscalationResult(created.id, escalateResult);
    await repo.updateCaseStatus(created.id, "submitted");
    await repo.updateCaseStatus(created.id, "analyzing");
    await repo.updateCaseStatus(created.id, "awaiting_decision");
    return created.id;
  }

  async function seedMeridian() {
    const created = await repo.createCase({
      ...orchidInput,
      customer: "[DEMO] Meridian Systems",
      issueTitle:
        "[DEMO] SSO login fails for some users after IdP certificate rotation",
      severity: "medium",
    });
    await repo.saveAnalysis(created.id, analysis);
    await repo.saveEscalationResult(created.id, {
      ...escalateResult,
      escalationScore: 20,
      recommendation: "insufficient_evidence",
    });
    await repo.updateCaseStatus(created.id, "submitted");
    await repo.updateCaseStatus(created.id, "analyzing");
    await repo.updateCaseStatus(created.id, "investigation_continues");
    return created.id;
  }

  async function approveOrchidOnFork(templateId: string, workspaceId: string) {
    const fork = await repo.cloneCaseIntoDemoWorkspace(templateId, workspaceId);
    const result = await decisions.recordDecision({
      caseId: fork.id,
      decision: "approved",
      rationale: "SAML signature failures warrant Engineering investigation.",
      decidedBy: "Demo Visitor",
      isSimulated: true,
    });
    return result.record;
  }

  it("creates simulated Jira after Orchid approval and is idempotent", async () => {
    const templateId = await seedOrchidAwaiting();
    const ws = await createWorkspace();
    const fork = await approveOrchidOnFork(templateId, ws.id);

    const first = await createDemoDownstreamRecord({
      caseId: fork.id,
      destination: "jira",
      repository: repo,
    });
    expect(first.reused).toBe(false);
    expect(first.record.externalReference).toMatch(/^ENG-DEMO-/);
    expect(first.record.payload).toMatchObject({ demo: true, simulated: true });

    const second = await createDemoDownstreamRecord({
      caseId: fork.id,
      destination: "jira",
      repository: repo,
    });
    expect(second.reused).toBe(true);
    expect(second.record.id).toBe(first.record.id);

    const listed = await repo.listDemoDownstreamRecordsForCase!({
      workspaceId: ws.id,
      caseId: fork.id,
    });
    expect(listed).toHaveLength(1);

    const template = await repo.getCaseById(templateId);
    expect(template?.status).toBe("awaiting_decision");
    expect(template?.handoff).toBeUndefined();
  });

  it("creates a separate simulated Rootly record for the same case", async () => {
    const templateId = await seedOrchidAwaiting();
    const ws = await createWorkspace();
    const fork = await approveOrchidOnFork(templateId, ws.id);

    const jira = await createDemoDownstreamRecord({
      caseId: fork.id,
      destination: "jira",
      repository: repo,
    });
    const rootly = await createDemoDownstreamRecord({
      caseId: fork.id,
      destination: "rootly",
      repository: repo,
    });
    expect(rootly.record.externalReference).toMatch(/^INC-DEMO-/);
    expect(rootly.record.id).not.toBe(jira.record.id);

    const listed = await repo.listDemoDownstreamRecordsForCase!({
      workspaceId: ws.id,
      caseId: fork.id,
    });
    expect(listed).toHaveLength(2);
  });

  it("preserves Vertex approval on fork and saves downstream without a second decision", async () => {
    const created = await repo.createCase({
      ...orchidInput,
      customer: "[DEMO] Vertex Media",
      product: "API Gateway",
      issueTitle: "[DEMO] Intermittent HTTP 504 Gateway Timeout Errors",
    });
    await repo.saveAnalysis(created.id, analysis);
    await repo.saveEscalationResult(created.id, {
      ...escalateResult,
      escalationScore: 100,
    });
    await repo.updateCaseStatus(created.id, "submitted");
    await repo.updateCaseStatus(created.id, "analyzing");
    await repo.updateCaseStatus(created.id, "awaiting_decision");
    await decisions.recordDecision({
      caseId: created.id,
      decision: "approved",
      rationale: "HTTP 504 gateway timeouts were reproduced in production.",
      decidedBy: "Support Lead",
      isSimulated: false,
    });

    const template = await repo.getCaseById(created.id);
    await createWorkspace();
    const result = await createDemoDownstreamRecord({
      caseId: created.id,
      destination: "jira",
      repository: repo,
    });

    expect(result.redirectedFromTemplate).toBe(true);
    expect(result.caseRecord.id).not.toBe(created.id);
    expect(result.caseRecord.decision?.decidedBy).toBe("Support Lead");
    expect(result.caseRecord.decision?.isSimulated).toBe(false);
    expect(result.caseRecord.decision?.id).not.toBe(template?.decision?.id);
    expect(result.record.caseId).toBe(result.caseRecord.id);

    const unchanged = await repo.getCaseById(created.id);
    expect(unchanged?.decision?.id).toBe(template?.decision?.id);
  });

  it("rejects Meridian without creating a downstream record", async () => {
    const meridianId = await seedMeridian();
    const ws = await createWorkspace();

    await expect(
      createDemoDownstreamRecord({
        caseId: meridianId,
        destination: "jira",
        repository: repo,
      }),
    ).rejects.toBeInstanceOf(DownstreamNotEligibleError);

    expect(
      await repo.listDemoDownstreamRecordsForCase!({
        workspaceId: ws.id,
        caseId: meridianId,
      }),
    ).toHaveLength(0);
  });

  it("isolates two visitors and cascades cleanup", async () => {
    const templateId = await seedOrchidAwaiting();
    const wsA = await createWorkspace();
    const forkA = await approveOrchidOnFork(templateId, wsA.id);
    const a = await createDemoDownstreamRecord({
      caseId: forkA.id,
      destination: "jira",
      repository: repo,
    });

    const wsB: DemoWorkspace = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: buildDemoWorkspaceExpiry(),
    };
    await repo.createDemoWorkspace(wsB);
    activeWorkspace = wsB;
    const forkB = await approveOrchidOnFork(templateId, wsB.id);
    const b = await createDemoDownstreamRecord({
      caseId: forkB.id,
      destination: "jira",
      repository: repo,
    });
    expect(a.record.id).not.toBe(b.record.id);

    expect(
      await repo.getDemoDownstreamRecordById!(a.record.id, wsB.id),
    ).toBeNull();
    expect(
      await repo.getDemoDownstreamRecordById!(a.record.id, wsA.id),
    ).not.toBeNull();

    // Expire workspace A and purge — cascades simulated records.
    const expired = { ...wsA, expiresAt: "2020-01-01T00:00:00.000Z" };
    await repo.createDemoWorkspace(expired).catch(() => undefined);
    // Overwrite expiry via recreate path: touch map through purge after replacing.
    (repo as unknown as { workspaces: Map<string, DemoWorkspace> }).workspaces.set(
      wsA.id,
      expired,
    );
    await repo.purgeExpiredDemoWorkspaces("2020-01-02T00:00:00.000Z");
    expect(
      await repo.getDemoDownstreamRecordById!(a.record.id, wsA.id),
    ).toBeNull();
    expect(
      await repo.getDemoDownstreamRecordById!(b.record.id, wsB.id),
    ).not.toBeNull();
  });

  it("handles concurrent creates without duplicates", async () => {
    const templateId = await seedOrchidAwaiting();
    const ws = await createWorkspace();
    const fork = await approveOrchidOnFork(templateId, ws.id);

    const [x, y] = await Promise.all([
      createDemoDownstreamRecord({
        caseId: fork.id,
        destination: "rootly",
        repository: repo,
      }),
      createDemoDownstreamRecord({
        caseId: fork.id,
        destination: "rootly",
        repository: repo,
      }),
    ]);
    expect(x.record.id).toBe(y.record.id);
    const listed = await repo.listDemoDownstreamRecordsForCase!({
      workspaceId: ws.id,
      caseId: fork.id,
    });
    expect(listed.filter((r) => r.destination === "rootly")).toHaveLength(1);
  });

  it("never invokes external Jira or Rootly network calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const templateId = await seedOrchidAwaiting();
    const ws = await createWorkspace();
    const fork = await approveOrchidOnFork(templateId, ws.id);
    await createDemoDownstreamRecord({
      caseId: fork.id,
      destination: "jira",
      repository: repo,
    });
    await createDemoDownstreamRecord({
      caseId: fork.id,
      destination: "rootly",
      repository: repo,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

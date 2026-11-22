import { beforeEach, describe, expect, it } from "vitest";
import { DecisionService } from "@/lib/cases/decision-service";
import {
  assertCaseReadableByWorkspace,
  DemoCaseAccessError,
} from "@/lib/demo/demo-case-access";
import { buildDemoWorkspaceExpiry } from "@/lib/demo/demo-workspace";
import {
  signDemoWorkspaceCookie,
  verifyDemoWorkspaceCookie,
  DemoWorkspaceCookieError,
} from "@/lib/demo/demo-workspace-cookie";
import { resolveWritableDemoCase } from "@/lib/demo/resolve-writable-demo-case";
import { InMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
import {
  getInMemoryTechnicalEvidenceRepository,
  resetInMemoryTechnicalEvidenceRepository,
} from "@/lib/repositories/in-memory-technical-evidence-repository";
import type {
  CreateCaseInput,
  EscalationEngineResult,
  StoredAnalysis,
} from "@/types";

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

const meridianInput: CreateCaseInput = {
  ...orchidInput,
  customer: "[DEMO] Meridian Systems",
  issueTitle: "[DEMO] SSO login fails for some users after IdP certificate rotation",
  severity: "medium",
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

const insufficientResult: EscalationEngineResult = {
  ...escalateResult,
  escalationScore: 20,
  recommendation: "insufficient_evidence",
  recommendationReasons: ["Missing SAML package"],
};

describe("Phase 2A anonymous workspace lifecycle (memory)", () => {
  let repo: InMemoryCaseRepository;
  let decisions: DecisionService;

  beforeEach(() => {
    repo = new InMemoryCaseRepository();
    decisions = new DecisionService(repo);
    resetInMemoryTechnicalEvidenceRepository();
  });

  async function seedOrchid() {
    const created = await repo.createCase(orchidInput);
    await repo.saveAnalysis(created.id, analysis);
    await repo.saveEscalationResult(created.id, escalateResult);
    await repo.updateCaseStatus(created.id, "submitted");
    await repo.updateCaseStatus(created.id, "analyzing");
    await repo.updateCaseStatus(created.id, "awaiting_decision");
    return created.id;
  }

  async function seedMeridian() {
    const created = await repo.createCase(meridianInput);
    await repo.saveAnalysis(created.id, {
      ...analysis,
      id: "an-m",
      aiResult: {
        ...analysis.aiResult,
        assessedSeverity: "medium",
        missingEvidence: ["Complete SAML package"],
        aiEscalationAssessment: "insufficient_data",
      },
    });
    await repo.saveEscalationResult(created.id, insufficientResult);
    await repo.updateCaseStatus(created.id, "submitted");
    await repo.updateCaseStatus(created.id, "analyzing");
    await repo.updateCaseStatus(created.id, "investigation_continues");
    return created.id;
  }

  async function seedVertexApproved() {
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
    return created.id;
  }

  async function createWorkspace() {
    const workspace = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: buildDemoWorkspaceExpiry(),
    };
    await repo.createDemoWorkspace(workspace);
    return workspace;
  }

  it("lists shared cases without a workspace and hides foreign forks", async () => {
    const orchidId = await seedOrchid();
    const wsA = await createWorkspace();
    const wsB = await createWorkspace();
    const forkA = await repo.cloneCaseIntoDemoWorkspace(orchidId, wsA.id);

    const noWs = await repo.listCases({ includeSharedTemplates: true });
    expect(noWs.map((c) => c.id)).toContain(orchidId);
    expect(noWs.map((c) => c.id)).not.toContain(forkA.id);

    const forA = await repo.listCases({
      demoWorkspaceId: wsA.id,
      includeSharedTemplates: true,
    });
    expect(forA.map((c) => c.id)).toEqual(
      expect.arrayContaining([orchidId, forkA.id]),
    );

    const forB = await repo.listCases({
      demoWorkspaceId: wsB.id,
      includeSharedTemplates: true,
    });
    expect(forB.map((c) => c.id)).toContain(orchidId);
    expect(forB.map((c) => c.id)).not.toContain(forkA.id);
  });

  it("verifies signed cookies and rejects missing/invalid/tampered/expired", () => {
    const id = crypto.randomUUID();
    const expiresAt = buildDemoWorkspaceExpiry();
    const cookie = signDemoWorkspaceCookie(id, { expiresAt });
    expect(verifyDemoWorkspaceCookie(cookie)).toBe(id);

    expect(() => verifyDemoWorkspaceCookie(null)).toThrow(DemoWorkspaceCookieError);
    expect(() => verifyDemoWorkspaceCookie("not-valid")).toThrow(
      DemoWorkspaceCookieError,
    );
    expect(() => verifyDemoWorkspaceCookie(`${cookie}x`)).toThrow(
      DemoWorkspaceCookieError,
    );
    expect(() =>
      verifyDemoWorkspaceCookie(cookie, {
        now: new Date(Date.parse(expiresAt) + 1000),
      }),
    ).toThrow(/expired/i);
  });

  it("creates/reuses forks and isolates two visitors", async () => {
    const orchidId = await seedOrchid();
    const wsA = await createWorkspace();
    const wsB = await createWorkspace();

    const a1 = await resolveWritableDemoCase(orchidId, wsA.id, repo);
    const a2 = await resolveWritableDemoCase(orchidId, wsA.id, repo);
    expect(a1.record.id).toBe(a2.record.id);
    expect(a1.record.id).not.toBe(orchidId);

    const b1 = await resolveWritableDemoCase(orchidId, wsB.id, repo);
    expect(b1.record.id).not.toBe(a1.record.id);

    expect(() =>
      assertCaseReadableByWorkspace(a1.record, wsB.id),
    ).toThrow(DemoCaseAccessError);
    expect(() =>
      assertCaseReadableByWorkspace(a1.record, null),
    ).toThrow(DemoCaseAccessError);
  });

  it("is concurrent-safe for the same workspace+template", async () => {
    const orchidId = await seedOrchid();
    const ws = await createWorkspace();
    const [x, y] = await Promise.all([
      repo.cloneCaseIntoDemoWorkspace(orchidId, ws.id),
      repo.cloneCaseIntoDemoWorkspace(orchidId, ws.id),
    ]);
    expect(x.id).toBe(y.id);
  });

  it("approves Orchid on a private fork without mutating the template", async () => {
    const orchidId = await seedOrchid();
    const ws = await createWorkspace();
    const resolved = await resolveWritableDemoCase(orchidId, ws.id, repo);

    const result = await decisions.recordDecision({
      caseId: resolved.record.id,
      decision: "approved",
      rationale: "SAML signature failures warrant Engineering investigation.",
      decidedBy: "Demo Visitor",
      isSimulated: true,
    });

    expect(result.record.status).toBe("escalated");
    expect(result.decision.isSimulated).toBe(true);
    expect(result.handoff?.isSimulated).toBe(true);
    expect(result.handoff?.decisionId).toBe(result.decision.id);

    const template = await repo.getCaseById(orchidId);
    expect(template?.status).toBe("awaiting_decision");
    expect(template?.decision).toBeUndefined();
    expect(template?.handoff).toBeUndefined();
  });

  it("rejects Meridian ordinary approval", async () => {
    const meridianId = await seedMeridian();
    const ws = await createWorkspace();
    const resolved = await resolveWritableDemoCase(meridianId, ws.id, repo);

    await expect(
      decisions.recordDecision({
        caseId: resolved.record.id,
        decision: "approved",
        rationale: "Trying to approve without escalate recommendation.",
        isSimulated: true,
      }),
    ).rejects.toThrow(/not awaiting a human decision|recommends escalation/i);

    const template = await repo.getCaseById(meridianId);
    expect(template?.status).toBe("investigation_continues");
  });

  it("preserves Vertex approval provenance on fork without a second decision", async () => {
    const vertexId = await seedVertexApproved();
    const template = await repo.getCaseById(vertexId);
    expect(template?.status).toBe("escalated");
    expect(template?.decision?.decidedBy).toBe("Support Lead");

    const ws = await createWorkspace();
    const fork = await repo.cloneCaseIntoDemoWorkspace(vertexId, ws.id);

    expect(fork.status).toBe("escalated");
    expect(fork.decision?.decidedBy).toBe("Support Lead");
    expect(fork.decision?.isSimulated).toBe(false);
    expect(fork.handoff?.isSimulated).toBe(false);
    expect(fork.decision?.id).not.toBe(template?.decision?.id);
    expect(fork.handoff?.decisionId).toBe(fork.decision?.id);

    await expect(
      decisions.recordDecision({
        caseId: fork.id,
        decision: "approved",
        rationale: "Visitor must not re-approve an already escalated fork.",
        isSimulated: true,
      }),
    ).rejects.toThrow(/already been recorded/i);

    const unchanged = await repo.getCaseById(vertexId);
    expect(unchanged?.decision?.id).toBe(template?.decision?.id);
  });

  it("keeps shared templates immutable and purges expired workspaces", async () => {
    const orchidId = await seedOrchid();
    const evidence = getInMemoryTechnicalEvidenceRepository();
    await evidence.create({
      caseId: orchidId,
      evidenceType: "auth_error",
      title: "SAML error",
      body: "Signature validation failed",
      source: "demo_fictional",
      verificationStatus: "demo_fictional",
      sortOrder: 0,
    });

    const workspace = {
      id: crypto.randomUUID(),
      createdAt: "2026-01-01T00:00:00.000Z",
      lastActiveAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-02T00:00:00.000Z",
    };
    await repo.createDemoWorkspace(workspace);
    const fork = await repo.cloneCaseIntoDemoWorkspace(orchidId, workspace.id);
    expect(
      (await evidence.listByCaseId(fork.id)).length,
    ).toBe(1);

    const removed = await repo.purgeExpiredDemoWorkspaces(
      "2026-01-03T00:00:00.000Z",
    );
    expect(removed).toBe(1);
    expect(await repo.getCaseById(fork.id)).toBeNull();
    expect(await repo.getCaseById(orchidId)).not.toBeNull();
  });
});

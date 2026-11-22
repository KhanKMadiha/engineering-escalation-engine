import { beforeEach, describe, expect, it } from "vitest";
import { buildDemoWorkspaceExpiry } from "@/lib/demo/demo-workspace";
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

const sampleInput: CreateCaseInput = {
  customer: "[DEMO] Meridian Systems",
  product: "SSO",
  severity: "medium",
  issueTitle: "[DEMO] SSO auth fails",
  issueDescription: "Incomplete SAML package.",
  environment: "production",
  stepsToReproduce: "",
  expectedBehaviour: "Login succeeds",
  actualBehaviour: "Login fails",
  troubleshootingPerformed: "Requested SAML response",
  logsErrors: "",
  requestIds: "",
  incidentTimestamp: null,
  affectedCustomerCount: 1,
};

const analysis: StoredAnalysis = {
  id: "an-1",
  aiResult: {
    assessedSeverity: "medium",
    issueCategory: "configuration",
    reproducibility: "not_reproduced",
    suspectedProductDefect: false,
    reasoning: "Need SAML package.",
    evidenceIdentified: [],
    missingEvidence: ["SAML response"],
    recommendedNextSteps: ["Collect SAML"],
    suspectedRootCause: null,
    aiEscalationAssessment: "likely_escalate",
  },
  validatedEvidence: [],
  rejectedEvidence: [],
  evidenceCompletenessScore: 0.3,
  model: "demo",
  promptVersion: "1",
  createdAt: "2026-09-11T10:00:00.000Z",
  assessmentVersion: 1,
  isCurrent: true,
};

const escalation: EscalationEngineResult = {
  escalationScore: 78,
  recommendation: "escalate",
  contributingFactors: [],
  recommendationReasons: ["Score supports escalation"],
  source: "deterministic_engine",
  assessmentVersion: 1,
  isCurrent: true,
};

describe("minimal demo workspace clone (in-memory)", () => {
  let repo: InMemoryCaseRepository;

  beforeEach(() => {
    repo = new InMemoryCaseRepository();
    resetInMemoryTechnicalEvidenceRepository();
  });

  async function seedAwaitingTemplate() {
    const created = await repo.createCase(sampleInput);
    await repo.saveAnalysis(created.id, analysis);
    await repo.saveEscalationResult(created.id, escalation);
    await repo.updateCaseStatus(created.id, "submitted");
    await repo.updateCaseStatus(created.id, "analyzing");
    await repo.updateCaseStatus(created.id, "awaiting_decision");

    const evidence = getInMemoryTechnicalEvidenceRepository();
    await evidence.create({
      caseId: created.id,
      evidenceType: "auth_error",
      title: "Partial auth error note",
      body: "Signature validation failed",
      source: "demo_fictional",
      verificationStatus: "demo_fictional",
      sortOrder: 0,
    });

    return created.id;
  }

  it("clones case + current assessment + evidence metadata only", async () => {
    const templateId = await seedAwaitingTemplate();
    const workspace = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: buildDemoWorkspaceExpiry(),
    };
    await repo.createDemoWorkspace(workspace);

    const fork = await repo.cloneCaseIntoDemoWorkspace(templateId, workspace.id);
    expect(fork.id).not.toBe(templateId);
    expect(fork.demoWorkspaceId).toBe(workspace.id);
    expect(fork.clonedFromCaseId).toBe(templateId);
    expect(fork.status).toBe("awaiting_decision");
    expect(fork.analysis?.aiResult.missingEvidence).toEqual(["SAML response"]);
    expect(fork.escalationResult?.recommendation).toBe("escalate");
    expect(fork.decision).toBeUndefined();
    expect(fork.handoff).toBeUndefined();
    expect(fork.analysisHistory ?? []).toHaveLength(0);
    expect(fork.events).toHaveLength(1);
    expect(fork.events[0]?.eventType).toBe("case_created");

    const evidence = await getInMemoryTechnicalEvidenceRepository().listByCaseId(
      fork.id,
    );
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.title).toBe("Partial auth error note");
    expect(evidence[0]?.attachments).toEqual([]);

    const template = await repo.getCaseById(templateId);
    expect(template?.demoWorkspaceId ?? null).toBeNull();
    expect(template?.events.length).toBeGreaterThan(1);
  });

  it("is idempotent and concurrent-safe for the same workspace+template", async () => {
    const templateId = await seedAwaitingTemplate();
    const workspace = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: buildDemoWorkspaceExpiry(),
    };
    await repo.createDemoWorkspace(workspace);

    const [a, b] = await Promise.all([
      repo.cloneCaseIntoDemoWorkspace(templateId, workspace.id),
      repo.cloneCaseIntoDemoWorkspace(templateId, workspace.id),
    ]);
    expect(a.id).toBe(b.id);

    const again = await repo.cloneCaseIntoDemoWorkspace(
      templateId,
      workspace.id,
    );
    expect(again.id).toBe(a.id);
  });

  it("forks already-approved templates preserving decision and handoff", async () => {
    const templateId = await seedAwaitingTemplate();
    const record = await repo.getCaseById(templateId);
    if (!record) throw new Error("missing");
    record.status = "escalated";
    record.decision = {
      id: "d-original",
      caseId: templateId,
      decision: "approved",
      rationale: "Clear product defect with evidence.",
      decidedAt: "2026-09-11T12:00:00.000Z",
      decidedBy: "Priya Raman",
      escalationScoreAtDecision: 78,
      recommendationAtDecision: "escalate",
      source: "human_decision",
      isSimulated: false,
    };
    record.decisions = [record.decision];
    record.handoff = {
      id: "h1",
      caseId: templateId,
      title: "Handoff",
      summary: "Approved",
      customerImpact: "1",
      environment: "production",
      reportedSeverity: "medium",
      affectedCustomerCount: 1,
      issueCategory: "configuration",
      stepsToReproduce: "",
      expectedBehaviour: "",
      actualBehaviour: "",
      reproducibility: "not_reproduced",
      troubleshootingPerformed: "",
      evidence: [],
      missingEvidence: [],
      suspectedRootCause: "Not established",
      escalationScore: 78,
      escalationRecommendation: "escalate",
      decisionRationale: "Approved",
      createdAt: new Date().toISOString(),
      source: "engineering_handoff",
      decisionId: "d-original",
    };
    // Direct map mutation for test — repository has no public replace helper.
    (repo as unknown as { cases: Map<string, typeof record> }).cases.set(
      templateId,
      record,
    );

    const workspace = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: buildDemoWorkspaceExpiry(),
    };
    await repo.createDemoWorkspace(workspace);

    const fork = await repo.cloneCaseIntoDemoWorkspace(templateId, workspace.id);
    expect(fork.id).not.toBe(templateId);
    expect(fork.demoWorkspaceId).toBe(workspace.id);
    expect(fork.clonedFromCaseId).toBe(templateId);
    expect(fork.status).toBe("escalated");

    expect(fork.decision?.id).not.toBe("d-original");
    expect(fork.decision?.caseId).toBe(fork.id);
    expect(fork.decision?.decision).toBe("approved");
    expect(fork.decision?.decidedBy).toBe("Priya Raman");
    expect(fork.decision?.decidedAt).toBe("2026-09-11T12:00:00.000Z");
    expect(fork.decision?.rationale).toBe("Clear product defect with evidence.");
    expect(fork.decision?.isSimulated).toBe(false);

    expect(fork.handoff?.id).not.toBe("h1");
    expect(fork.handoff?.caseId).toBe(fork.id);
    expect(fork.handoff?.decisionId).toBe(fork.decision?.id);
    expect(fork.handoff?.isSimulated).toBe(false);

    const template = await repo.getCaseById(templateId);
    expect(template?.decision?.id).toBe("d-original");
    expect(template?.handoff?.id).toBe("h1");
    expect(template?.demoWorkspaceId ?? null).toBeNull();
  });

  it("purges expired workspaces and their forks", async () => {
    const templateId = await seedAwaitingTemplate();
    const workspace = {
      id: crypto.randomUUID(),
      createdAt: "2026-01-01T00:00:00.000Z",
      lastActiveAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-02T00:00:00.000Z",
    };
    await repo.createDemoWorkspace(workspace);
    const fork = await repo.cloneCaseIntoDemoWorkspace(templateId, workspace.id);

    const removed = await repo.purgeExpiredDemoWorkspaces(
      "2026-01-03T00:00:00.000Z",
    );
    expect(removed).toBe(1);
    expect(await repo.getDemoWorkspace(workspace.id)).toBeNull();
    expect(await repo.getCaseById(fork.id)).toBeNull();
    expect(await repo.getCaseById(templateId)).not.toBeNull();
  });
});

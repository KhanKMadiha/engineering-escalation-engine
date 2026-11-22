import { afterAll, describe, expect, it } from "vitest";
import {
  DecisionNotEligibleError,
  DecisionService,
} from "@/lib/cases/decision-service";
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
import {
  createDemoDownstreamRecord,
  DownstreamNotEligibleError,
} from "@/lib/demo/downstream-record-service";
import { resolveWritableDemoCase } from "@/lib/demo/resolve-writable-demo-case";
import {
  PROTECTED_PRODUCTION_SUPABASE_REF,
  assertNotProtectedProductionSupabase,
} from "@/lib/supabase/staging-guard";
import type {
  CreateCaseInput,
  EscalationEngineResult,
  StoredAnalysis,
} from "@/types";

/**
 * Phase 3A live staging verification.
 *
 * Requires:
 *   RUN_SUPABASE_INTEGRATION=1
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DEMO_WORKSPACE_SECRET
 *   targeting an isolated staging project (never production).
 *
 * Prefer: `npm run test:supabase:staging` which loads `.env.staging` only.
 */

const enabled =
  process.env.RUN_SUPABASE_INTEGRATION === "1" &&
  Boolean(process.env.SUPABASE_URL?.trim()) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) &&
  Boolean(process.env.DEMO_WORKSPACE_SECRET?.trim());

const analysisBase: StoredAnalysis = {
  id: "an-phase3a",
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

const insufficient: EscalationEngineResult = {
  escalationScore: 20,
  recommendation: "insufficient_evidence",
  contributingFactors: [],
  recommendationReasons: ["Missing evidence"],
  source: "deterministic_engine",
  assessmentVersion: 1,
  isCurrent: true,
};

const createdCaseIds: string[] = [];
const createdWorkspaceIds: string[] = [];

async function seedTemplate(options: {
  input: CreateCaseInput;
  result: EscalationEngineResult;
  status: "awaiting_decision" | "investigation_continues";
  analysis?: Partial<StoredAnalysis>;
}) {
  const { createSupabaseCaseRepository } = await import(
    "@/lib/supabase/supabase-case-repository"
  );
  const repo = createSupabaseCaseRepository();
  const created = await repo.createCase(options.input);
  createdCaseIds.push(created.id);
  await repo.saveAnalysis(created.id, {
    ...analysisBase,
    ...options.analysis,
    id: crypto.randomUUID(),
    aiResult: {
      ...analysisBase.aiResult,
      ...(options.analysis?.aiResult ?? {}),
      aiEscalationAssessment:
        options.result.recommendation === "escalate"
          ? "likely_escalate"
          : "insufficient_data",
      missingEvidence:
        options.result.recommendation === "insufficient_evidence"
          ? ["Complete SAML failure package"]
          : [],
    },
  });
  await repo.saveEscalationResult(created.id, options.result);
  await repo.updateCaseStatus(created.id, "submitted");
  await repo.updateCaseStatus(created.id, "analyzing");
  await repo.updateCaseStatus(created.id, options.status);
  return { repo, id: created.id };
}

describe("Phase 3A staging gate", () => {
  it("skips live staging tests when isolated credentials are absent", () => {
    if (!enabled) {
      expect(process.env.RUN_SUPABASE_INTEGRATION ?? "").not.toBe("1");
    }
  });

  it("documents that production project ref is protected", () => {
    expect(PROTECTED_PRODUCTION_SUPABASE_REF).toBe("zfpakilfxnwhlcfjgemw");
    expect(() =>
      assertNotProtectedProductionSupabase(
        `https://${PROTECTED_PRODUCTION_SUPABASE_REF}.supabase.co`,
      ),
    ).toThrow(/protected production/i);
  });
});

describe.skipIf(!enabled)("Phase 3A isolated Supabase staging", () => {
  it("refuses to run when SUPABASE_URL is the protected production project", () => {
    const ref = assertNotProtectedProductionSupabase(process.env.SUPABASE_URL, {
      context: "phase3a-live",
    });
    expect(ref).not.toBe(PROTECTED_PRODUCTION_SUPABASE_REF);
  });

  it("verifies Phase 2A/2B schema objects on the staging database", async () => {
    assertNotProtectedProductionSupabase(process.env.SUPABASE_URL);
    const { createSupabaseServerClient } = await import(
      "@/lib/supabase/client"
    );
    const client = createSupabaseServerClient();

    const { data: workspaceCols, error: workspaceErr } = await client
      .from("demo_workspaces")
      .select("id")
      .limit(0);
    expect(workspaceErr).toBeNull();
    expect(workspaceCols).toEqual([]);

    const { data: downstreamCols, error: downstreamErr } = await client
      .from("demo_downstream_records")
      .select("id")
      .limit(0);
    expect(downstreamErr).toBeNull();
    expect(downstreamCols).toEqual([]);

    // Probe fork columns on support_cases (PostgREST error if missing).
    const { error: caseColErr } = await client
      .from("support_cases")
      .select("id, demo_workspace_id, cloned_from_case_id")
      .limit(1);
    expect(caseColErr).toBeNull();

    const { error: decisionColErr } = await client
      .from("human_decisions")
      .select("id, is_simulated")
      .limit(1);
    expect(decisionColErr).toBeNull();

    const { error: handoffColErr } = await client
      .from("engineering_handoffs")
      .select("id, is_simulated, decision_id")
      .limit(1);
    expect(handoffColErr).toBeNull();

    const { error: rpcErr } = await client.rpc("purge_expired_demo_workspaces", {
      p_now: "1970-01-01T00:00:00.000Z",
    });
    expect(rpcErr).toBeNull();
  });

  it("signs and verifies workspace cookies; rejects tampering and expiry", () => {
    assertNotProtectedProductionSupabase(process.env.SUPABASE_URL);
    const workspaceId = crypto.randomUUID();
    const expiresAt = buildDemoWorkspaceExpiry();
    const token = signDemoWorkspaceCookie(workspaceId, { expiresAt });
    expect(verifyDemoWorkspaceCookie(token)).toBe(workspaceId);

    const [payload] = token.split(".");
    expect(() =>
      verifyDemoWorkspaceCookie(`${payload}.tampered-signature`),
    ).toThrow(DemoWorkspaceCookieError);

    const expired = signDemoWorkspaceCookie(workspaceId, {
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(() => verifyDemoWorkspaceCookie(expired)).toThrow(
      DemoWorkspaceCookieError,
    );
  });

  it("Orchid: CoW approve, handoff, Jira/Rootly idempotency, template unchanged", async () => {
    assertNotProtectedProductionSupabase(process.env.SUPABASE_URL);
    const marker = `P3A-Orchid-${Date.now()}`;
    const { repo, id: orchidId } = await seedTemplate({
      input: {
        customer: `[DEMO] Orchid Health ${marker}`,
        product: "SSO",
        severity: "high",
        issueTitle: `[DEMO] SAML SSO failing for some users (${marker})`,
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
      result: escalate,
      status: "awaiting_decision",
    });

    const workspace = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: buildDemoWorkspaceExpiry(),
    };
    await repo.createDemoWorkspace(workspace);
    createdWorkspaceIds.push(workspace.id);

    const fork = await resolveWritableDemoCase(orchidId, workspace.id, repo);
    expect(fork.record.id).not.toBe(orchidId);
    expect(fork.record.demoWorkspaceId).toBe(workspace.id);
    expect(fork.record.clonedFromCaseId).toBe(orchidId);

    const decisions = new DecisionService(repo);
    const approved = await decisions.recordDecision({
      caseId: fork.record.id,
      decision: "approved",
      rationale: "SAML signature failures warrant Engineering investigation.",
      decidedBy: "Phase3A Visitor",
      isSimulated: true,
    });
    expect(approved.record.status).toBe("escalated");
    expect(approved.handoff).toBeTruthy();
    expect(approved.decision.isSimulated).toBe(true);

    // Concurrent / idempotent Jira creates (repository path; session-independent).
    const handoffId = approved.handoff!.id;
    const [jiraA, jiraB] = await Promise.all([
      repo.saveDemoDownstreamRecord!({
        id: crypto.randomUUID(),
        demoWorkspaceId: workspace.id,
        caseId: fork.record.id,
        destination: "jira",
        externalReference: "ENG-DEMO-ORCHID-A",
        payload: { demo: true, kind: "jira_demo", marker },
        handoffId,
        createdAt: new Date().toISOString(),
      }),
      repo.saveDemoDownstreamRecord!({
        id: crypto.randomUUID(),
        demoWorkspaceId: workspace.id,
        caseId: fork.record.id,
        destination: "jira",
        externalReference: "ENG-DEMO-ORCHID-B",
        payload: { demo: true, kind: "jira_demo", marker },
        handoffId,
        createdAt: new Date().toISOString(),
      }),
    ]);
    expect(jiraA.id).toBe(jiraB.id);

    const rootly = await repo.saveDemoDownstreamRecord!({
      id: crypto.randomUUID(),
      demoWorkspaceId: workspace.id,
      caseId: fork.record.id,
      destination: "rootly",
      externalReference: "INC-DEMO-ORCHID-1",
      payload: { demo: true, kind: "rootly_demo", marker },
      handoffId,
      createdAt: new Date().toISOString(),
    });
    const rootlyAgain = await repo.getDemoDownstreamRecord!({
      workspaceId: workspace.id,
      caseId: fork.record.id,
      destination: "rootly",
    });
    expect(rootlyAgain?.id).toBe(rootly.id);

    const listed = await repo.listDemoDownstreamRecordsForCase!({
      workspaceId: workspace.id,
      caseId: fork.record.id,
    });
    expect(listed).toHaveLength(2);

    const template = await repo.getCaseById(orchidId);
    expect(template?.status).toBe("awaiting_decision");
    expect(template?.decision).toBeUndefined();
    expect(template?.handoff).toBeUndefined();
    expect(template?.demoWorkspaceId ?? null).toBeNull();
  });

  it("Vertex: historical approval provenance preserved on fork; template unchanged", async () => {
    assertNotProtectedProductionSupabase(process.env.SUPABASE_URL);
    const marker = `P3A-Vertex-${Date.now()}`;
    const rationale =
      "HTTP 504 gateway timeouts were reproduced in production, affecting multiple customer accounts. Request IDs and gateway logs were captured during troubleshooting. Engineering investigation is required to determine the underlying cause.";

    const { repo, id: vertexId } = await seedTemplate({
      input: {
        customer: `[DEMO] Vertex Media ${marker}`,
        product: "API Gateway",
        severity: "high",
        issueTitle: `[DEMO] Intermittent HTTP 504 Gateway Timeout Errors (${marker})`,
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
      result: { ...escalate, escalationScore: 100 },
      status: "awaiting_decision",
      analysis: {
        aiResult: {
          ...analysisBase.aiResult,
          suspectedRootCause:
            "Upstream latency exceeding gateway timeout under peak load (inference; not proven).",
          reasoning:
            "High-severity production gateway timeouts with validated request IDs. Historical inference only.",
        },
      },
    });

    const decisions = new DecisionService(repo);
    await decisions.recordDecision({
      caseId: vertexId,
      decision: "approved",
      rationale,
      decidedBy: "Support Lead",
      isSimulated: false,
    });

    const before = await repo.getCaseById(vertexId);
    expect(before?.status).toBe("escalated");
    expect(before?.decision?.rationale).toBe(rationale);
    expect(before?.decision?.isSimulated).toBe(false);
    expect(before?.handoff?.decisionRationale).toBe(rationale);

    const workspace = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: buildDemoWorkspaceExpiry(),
    };
    await repo.createDemoWorkspace(workspace);
    createdWorkspaceIds.push(workspace.id);

    const fork = await repo.cloneCaseIntoDemoWorkspace!(vertexId, workspace.id);
    expect(fork.decision?.rationale).toBe(rationale);
    expect(fork.decision?.isSimulated).toBe(false);
    expect(fork.handoff?.decisionRationale).toBe(rationale);
    expect(fork.analysis?.aiResult.suspectedRootCause).toContain(
      "inference; not proven",
    );

    const template = await repo.getCaseById(vertexId);
    expect(template?.decision?.rationale).toBe(rationale);
    expect(template?.demoWorkspaceId ?? null).toBeNull();
  });

  it("Meridian: approval and downstream blocked; no unnecessary workspace from eligibility gate", async () => {
    assertNotProtectedProductionSupabase(process.env.SUPABASE_URL);
    const marker = `P3A-Meridian-${Date.now()}`;
    const { repo, id: meridianId } = await seedTemplate({
      input: {
        customer: `[DEMO] Meridian Systems ${marker}`,
        product: "SSO",
        severity: "medium",
        issueTitle: `[DEMO] SSO login fails for some users after IdP certificate rotation (${marker})`,
        issueDescription:
          "Some users cannot log in via SSO after an IdP certificate rotation. Still waiting for complete SAML failure package.",
        environment: "production",
        stepsToReproduce: "",
        expectedBehaviour: "SSO succeeds",
        actualBehaviour: "SSO fails for some users",
        troubleshootingPerformed: "Requested IdP logs",
        logsErrors: "n/a",
        requestIds: "n/a",
        incidentTimestamp: null,
        affectedCustomerCount: 2,
      },
      result: insufficient,
      status: "investigation_continues",
    });

    const beforeCount = createdWorkspaceIds.length;
    const decisions = new DecisionService(repo);
    await expect(
      decisions.recordDecision({
        caseId: meridianId,
        decision: "approved",
        rationale: "Should be rejected — insufficient evidence.",
        decidedBy: "Phase3A Visitor",
        isSimulated: true,
      }),
    ).rejects.toBeInstanceOf(DecisionNotEligibleError);

    await expect(
      createDemoDownstreamRecord({
        caseId: meridianId,
        destination: "jira",
        repository: repo,
      }),
    ).rejects.toBeInstanceOf(DownstreamNotEligibleError);

    // Soft eligibility must not require a workspace; no new workspace ids tracked here.
    expect(createdWorkspaceIds.length).toBe(beforeCount);

    const template = await repo.getCaseById(meridianId);
    expect(template?.status).toBe("investigation_continues");
    expect(template?.decision).toBeUndefined();
    expect(template?.demoWorkspaceId ?? null).toBeNull();
  });

  it("cross-workspace isolation and unique fork constraint", async () => {
    assertNotProtectedProductionSupabase(process.env.SUPABASE_URL);
    const marker = `P3A-Iso-${Date.now()}`;
    const { repo, id: templateId } = await seedTemplate({
      input: {
        customer: `[DEMO] Isolation Probe ${marker}`,
        product: "SSO",
        severity: "high",
        issueTitle: `[DEMO] Isolation probe ${marker}`,
        issueDescription: "Temporary Phase 3A isolation probe.",
        environment: "production",
        stepsToReproduce: "n/a",
        expectedBehaviour: "n/a",
        actualBehaviour: "n/a",
        troubleshootingPerformed: "n/a",
        logsErrors: "n/a",
        requestIds: "n/a",
      },
      result: escalate,
      status: "awaiting_decision",
    });

    const workspaceA = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: buildDemoWorkspaceExpiry(),
    };
    const workspaceB = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: buildDemoWorkspaceExpiry(),
    };
    await repo.createDemoWorkspace(workspaceA);
    await repo.createDemoWorkspace(workspaceB);
    createdWorkspaceIds.push(workspaceA.id, workspaceB.id);

    const forkA = await repo.cloneCaseIntoDemoWorkspace!(
      templateId,
      workspaceA.id,
    );
    assertCaseReadableByWorkspace(forkA, workspaceA.id);
    expect(() => assertCaseReadableByWorkspace(forkA, workspaceB.id)).toThrow(
      DemoCaseAccessError,
    );

    const forkAAgain = await repo.cloneCaseIntoDemoWorkspace!(
      templateId,
      workspaceA.id,
    );
    expect(forkAAgain.id).toBe(forkA.id);

    const forkB = await repo.cloneCaseIntoDemoWorkspace!(
      templateId,
      workspaceB.id,
    );
    expect(forkB.id).not.toBe(forkA.id);
    expect(forkB.demoWorkspaceId).toBe(workspaceB.id);
  });

  it("purge_expired_demo_workspaces cascades forks and downstream records", async () => {
    assertNotProtectedProductionSupabase(process.env.SUPABASE_URL);
    const marker = `P3A-Purge-${Date.now()}`;
    const { repo, id: templateId } = await seedTemplate({
      input: {
        customer: `[DEMO] Purge Probe ${marker}`,
        product: "SSO",
        severity: "high",
        issueTitle: `[DEMO] Purge probe ${marker}`,
        issueDescription: "Temporary Phase 3A purge probe.",
        environment: "production",
        stepsToReproduce: "n/a",
        expectedBehaviour: "n/a",
        actualBehaviour: "n/a",
        troubleshootingPerformed: "n/a",
        logsErrors: "n/a",
        requestIds: "n/a",
      },
      result: escalate,
      status: "awaiting_decision",
    });

    // Create an active workspace, clone into it, then expire and purge.
    const workspace = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: buildDemoWorkspaceExpiry(),
    };
    await repo.createDemoWorkspace(workspace);
    const fork = await repo.cloneCaseIntoDemoWorkspace!(
      templateId,
      workspace.id,
    );
    await repo.saveDemoDownstreamRecord!({
      id: crypto.randomUUID(),
      demoWorkspaceId: workspace.id,
      caseId: fork.id,
      destination: "jira",
      externalReference: "ENG-DEMO-PURGE",
      payload: { demo: true, kind: "jira_demo" },
      handoffId: null,
      createdAt: new Date().toISOString(),
    });

    const { createSupabaseServerClient } = await import(
      "@/lib/supabase/client"
    );
    const client = createSupabaseServerClient();
    // Respect CHECK (expires_at > created_at) while making the workspace expired.
    const createdAt = new Date(Date.now() - 120_000).toISOString();
    const expiresAt = new Date(Date.now() - 60_000).toISOString();
    const { error: expireError } = await client
      .from("demo_workspaces")
      .update({
        created_at: createdAt,
        last_active_at: createdAt,
        expires_at: expiresAt,
      })
      .eq("id", workspace.id);
    expect(expireError).toBeNull();

    const purged = await repo.purgeExpiredDemoWorkspaces(
      new Date().toISOString(),
    );
    expect(purged).toBeGreaterThanOrEqual(1);

    expect(await repo.getDemoWorkspace!(workspace.id)).toBeNull();
    expect(await repo.getCaseById(fork.id)).toBeNull();
    expect(
      await repo.getDemoDownstreamRecord!({
        workspaceId: workspace.id,
        caseId: fork.id,
        destination: "jira",
      }),
    ).toBeNull();

    const template = await repo.getCaseById(templateId);
    expect(template?.id).toBe(templateId);
    expect(template?.demoWorkspaceId ?? null).toBeNull();
  });

  afterAll(async () => {
    if (!enabled) {
      return;
    }
    // Best-effort cleanup of non-expired workspaces created by this file.
    try {
      assertNotProtectedProductionSupabase(process.env.SUPABASE_URL);
      const { createSupabaseCaseRepository } = await import(
        "@/lib/supabase/supabase-case-repository"
      );
      const repo = createSupabaseCaseRepository();
      for (const workspaceId of createdWorkspaceIds) {
        const workspace = await repo.getDemoWorkspace?.(workspaceId);
        if (!workspace) {
          continue;
        }
        // Force expiry then purge.
        const { createSupabaseServerClient } = await import(
          "@/lib/supabase/client"
        );
        const client = createSupabaseServerClient();
        const createdAt = new Date(Date.now() - 120_000).toISOString();
        const expiresAt = new Date(Date.now() - 60_000).toISOString();
        await client
          .from("demo_workspaces")
          .update({
            created_at: createdAt,
            last_active_at: createdAt,
            expires_at: expiresAt,
          })
          .eq("id", workspaceId);
      }
      if (createdWorkspaceIds.length > 0) {
        await repo.purgeExpiredDemoWorkspaces(new Date().toISOString());
      }
    } catch {
      // Staging cleanup is best-effort; failures should not hide test results.
    }
  });
});

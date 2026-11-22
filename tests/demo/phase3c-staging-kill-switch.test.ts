import { afterAll, describe, expect, it, vi } from "vitest";
import { DecisionService } from "@/lib/cases/decision-service";
import { ensureDemoWorkspaceForWrite } from "@/lib/demo/demo-workspace-session";
import {
  createDemoDownstreamRecord,
} from "@/lib/demo/downstream-record-service";
import { resolveWritableDemoCase } from "@/lib/demo/resolve-writable-demo-case";
import {
  DemoInteractiveWritesDisabledError,
  isDemoInteractiveWritesEnabled,
} from "@/lib/security/runtime-access";
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
 * Phase 3C targeted staging verification for DEMO_INTERACTIVE_WRITES.
 * Loads only via `scripts/run-phase3c-staging-kill-switch.mjs` (.env.staging).
 * Never targets production.
 */

const cookieStore = {
  value: null as string | null,
  get(name: string) {
    void name;
    return this.value ? { value: this.value } : undefined;
  },
  set(name: string, value: string) {
    void name;
    this.value = value;
  },
};

vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
}));

const enabled =
  process.env.RUN_SUPABASE_INTEGRATION === "1" &&
  Boolean(process.env.SUPABASE_URL?.trim()) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) &&
  Boolean(process.env.DEMO_WORKSPACE_SECRET?.trim());

const analysisBase: StoredAnalysis = {
  id: "an-phase3c-ks",
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

const createdCaseIds: string[] = [];
const createdWorkspaceIds: string[] = [];

function setInteractiveWrites(enabledFlag: boolean) {
  process.env.DEMO_INTERACTIVE_WRITES = enabledFlag ? "1" : "0";
}

async function seedOrchidTemplate(marker: string) {
  const { createSupabaseCaseRepository } = await import(
    "@/lib/supabase/supabase-case-repository"
  );
  const repo = createSupabaseCaseRepository();
  const input: CreateCaseInput = {
    customer: `[DEMO] Orchid Health ${marker}`,
    product: "SSO",
    severity: "high",
    issueTitle: `[DEMO] SAML SSO failing for some users (${marker})`,
    issueDescription:
      "Some users fail SAML SSO while peers on the same IdP succeed.",
    environment: "production",
    stepsToReproduce: "1. Attempt SSO",
    expectedBehaviour: "Login succeeds",
    actualBehaviour: "Login fails",
    troubleshootingPerformed: "Captured SAML error",
    logsErrors: "Signature validation failed",
    requestIds: `req-demo-ks-${marker}`,
    incidentTimestamp: null,
    affectedCustomerCount: 2,
  };
  const created = await repo.createCase(input);
  createdCaseIds.push(created.id);
  await repo.saveAnalysis(created.id, {
    ...analysisBase,
    id: crypto.randomUUID(),
  });
  await repo.saveEscalationResult(created.id, escalate);
  await repo.updateCaseStatus(created.id, "submitted");
  await repo.updateCaseStatus(created.id, "analyzing");
  await repo.updateCaseStatus(created.id, "awaiting_decision");
  return { repo, templateId: created.id };
}

async function countRows(
  client: Awaited<
    ReturnType<typeof import("@/lib/supabase/client").createSupabaseServerClient>
  >,
  table: string,
  column: string,
  value: string,
) {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) {
    throw error;
  }
  return count ?? 0;
}

describe("Phase 3C kill-switch staging gate", () => {
  it("skips when staging credentials are absent", () => {
    if (!enabled) {
      expect(process.env.RUN_SUPABASE_INTEGRATION ?? "").not.toBe("1");
    }
  });
});

describe.skipIf(!enabled)("Phase 3C staging DEMO_INTERACTIVE_WRITES", () => {
  afterAll(async () => {
    setInteractiveWrites(true);
    cookieStore.value = null;
    if (!enabled) {
      return;
    }
    try {
      assertNotProtectedProductionSupabase(process.env.SUPABASE_URL);
      const { createSupabaseCaseRepository } = await import(
        "@/lib/supabase/supabase-case-repository"
      );
      const { createSupabaseServerClient } = await import(
        "@/lib/supabase/client"
      );
      const repo = createSupabaseCaseRepository();
      const client = createSupabaseServerClient();
      for (const workspaceId of createdWorkspaceIds) {
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
        await repo.purgeExpiredDemoWorkspaces?.(new Date().toISOString());
      }
      for (const caseId of createdCaseIds) {
        await client.from("support_cases").delete().eq("id", caseId);
      }
    } catch {
      // Best-effort cleanup; failures should not hide assertion results.
    }
  });

  it("refuses the protected production project", () => {
    const ref = assertNotProtectedProductionSupabase(process.env.SUPABASE_URL, {
      context: "phase3c-kill-switch",
    });
    expect(ref).toBe("mmebhgkpylaxqvtjrvyt");
    expect(ref).not.toBe(PROTECTED_PRODUCTION_SUPABASE_REF);
  });

  it("freezes interactive writes while keeping queue/templates and existing forks readable", async () => {
    assertNotProtectedProductionSupabase(process.env.SUPABASE_URL);
    const { createSupabaseServerClient } = await import(
      "@/lib/supabase/client"
    );
    const client = createSupabaseServerClient();
    const marker = `P3C-KS-${Date.now()}`;

    // --- Baseline with writes enabled: create private Orchid fork + one Jira ---
    setInteractiveWrites(true);
    expect(isDemoInteractiveWritesEnabled()).toBe(true);

    const { repo, templateId } = await seedOrchidTemplate(marker);
    const listedBefore = await repo.listCases();
    expect(listedBefore.some((c) => c.id === templateId)).toBe(true);
    const templateBefore = await repo.getCaseById(templateId);
    expect(templateBefore?.demoWorkspaceId ?? null).toBeNull();

    const session = await ensureDemoWorkspaceForWrite(repo);
    createdWorkspaceIds.push(session.workspaceId);
    expect(session.created).toBe(true);

    const fork = await resolveWritableDemoCase(
      templateId,
      session.workspaceId,
      repo,
    );
    createdCaseIds.push(fork.record.id);
    expect(fork.record.id).not.toBe(templateId);

    const decisions = new DecisionService(repo);
    const approved = await decisions.recordDecision({
      caseId: fork.record.id,
      decision: "approved",
      rationale: "Kill-switch staging baseline approval.",
      decidedBy: "Phase3C KillSwitch",
      isSimulated: true,
    });
    expect(approved.handoff).toBeTruthy();

    const jira = await createDemoDownstreamRecord({
      caseId: fork.record.id,
      destination: "jira",
      repository: repo,
    });
    expect(jira.record.destination).toBe("jira");
    expect(jira.reused).toBe(false);

    const decisionCountBefore = await countRows(
      client,
      "human_decisions",
      "case_id",
      fork.record.id,
    );
    const handoffCountBefore = await countRows(
      client,
      "engineering_handoffs",
      "case_id",
      fork.record.id,
    );
    const downstreamCountBefore = await countRows(
      client,
      "demo_downstream_records",
      "case_id",
      fork.record.id,
    );
    expect(decisionCountBefore).toBe(1);
    expect(handoffCountBefore).toBe(1);
    expect(downstreamCountBefore).toBe(1);

    const workspaceBefore = await repo.getDemoWorkspace!(session.workspaceId);
    expect(workspaceBefore).toBeTruthy();

    // --- Kill-switch OFF ---
    setInteractiveWrites(false);
    expect(isDemoInteractiveWritesEnabled()).toBe(false);

    const queueWhileFrozen = await repo.listCases();
    expect(queueWhileFrozen.some((c) => c.id === templateId)).toBe(true);
    const templateWhileFrozen = await repo.getCaseById(templateId);
    expect(templateWhileFrozen?.status).toBe("awaiting_decision");
    expect(templateWhileFrozen?.decision ?? null).toBeNull();

    const forkWhileFrozen = await repo.getCaseById(fork.record.id);
    expect(forkWhileFrozen?.status).toBe("escalated");
    expect(forkWhileFrozen?.decision?.isSimulated).toBe(true);
    expect(forkWhileFrozen?.handoff).toBeTruthy();

    const existingJira = await repo.getDemoDownstreamRecord!({
      workspaceId: session.workspaceId,
      caseId: fork.record.id,
      destination: "jira",
    });
    expect(existingJira?.id).toBe(jira.record.id);

    await expect(ensureDemoWorkspaceForWrite(repo)).rejects.toBeInstanceOf(
      DemoInteractiveWritesDisabledError,
    );

    // Fresh Orchid approve path cannot open a workspace while frozen.
    const approveBlockedMarker = `${marker}-blocked`;
    const blockedSeed = await seedOrchidTemplate(approveBlockedMarker);
    await expect(ensureDemoWorkspaceForWrite(repo)).rejects.toBeInstanceOf(
      DemoInteractiveWritesDisabledError,
    );
    const blockedTemplate = await repo.getCaseById(blockedSeed.templateId);
    expect(blockedTemplate?.status).toBe("awaiting_decision");
    expect(blockedTemplate?.decision ?? null).toBeNull();

    // Existing private case: Jira/Rootly creation blocked; prior row remains.
    await expect(
      createDemoDownstreamRecord({
        caseId: fork.record.id,
        destination: "rootly",
        repository: repo,
      }),
    ).rejects.toBeInstanceOf(DemoInteractiveWritesDisabledError);
    await expect(
      createDemoDownstreamRecord({
        caseId: fork.record.id,
        destination: "jira",
        repository: repo,
      }),
    ).rejects.toBeInstanceOf(DemoInteractiveWritesDisabledError);

    expect(
      await countRows(client, "human_decisions", "case_id", fork.record.id),
    ).toBe(decisionCountBefore);
    expect(
      await countRows(client, "engineering_handoffs", "case_id", fork.record.id),
    ).toBe(handoffCountBefore);
    expect(
      await countRows(
        client,
        "demo_downstream_records",
        "case_id",
        fork.record.id,
      ),
    ).toBe(downstreamCountBefore);
    expect(await repo.getDemoWorkspace!(session.workspaceId)).toBeTruthy();

    // --- Restore writes and confirm Orchid + downstream flow ---
    setInteractiveWrites(true);
    expect(isDemoInteractiveWritesEnabled()).toBe(true);

    cookieStore.value = null;
    const restoredSession = await ensureDemoWorkspaceForWrite(repo);
    createdWorkspaceIds.push(restoredSession.workspaceId);

    const restored = await seedOrchidTemplate(`${marker}-restored`);
    const restoredFork = await resolveWritableDemoCase(
      restored.templateId,
      restoredSession.workspaceId,
      repo,
    );
    createdCaseIds.push(restoredFork.record.id);

    const restoredDecision = await decisions.recordDecision({
      caseId: restoredFork.record.id,
      decision: "approved",
      rationale: "Kill-switch restored; Orchid approval works again.",
      decidedBy: "Phase3C KillSwitch",
      isSimulated: true,
    });
    expect(restoredDecision.record.status).toBe("escalated");
    expect(restoredDecision.handoff).toBeTruthy();

    const restoredJira = await createDemoDownstreamRecord({
      caseId: restoredFork.record.id,
      destination: "jira",
      repository: repo,
    });
    const restoredRootly = await createDemoDownstreamRecord({
      caseId: restoredFork.record.id,
      destination: "rootly",
      repository: repo,
    });
    expect(restoredJira.reused).toBe(false);
    expect(restoredRootly.reused).toBe(false);

    const jiraAgain = await createDemoDownstreamRecord({
      caseId: restoredFork.record.id,
      destination: "jira",
      repository: repo,
    });
    const rootlyAgain = await createDemoDownstreamRecord({
      caseId: restoredFork.record.id,
      destination: "rootly",
      repository: repo,
    });
    expect(jiraAgain.reused).toBe(true);
    expect(jiraAgain.record.id).toBe(restoredJira.record.id);
    expect(rootlyAgain.reused).toBe(true);
    expect(rootlyAgain.record.id).toBe(restoredRootly.record.id);

    expect(
      await countRows(
        client,
        "human_decisions",
        "case_id",
        restoredFork.record.id,
      ),
    ).toBe(1);
    expect(
      await countRows(
        client,
        "engineering_handoffs",
        "case_id",
        restoredFork.record.id,
      ),
    ).toBe(1);
    expect(
      await countRows(
        client,
        "demo_downstream_records",
        "case_id",
        restoredFork.record.id,
      ),
    ).toBe(2);

    // Baseline private fork unchanged after restore path on a different workspace.
    expect(
      await countRows(client, "human_decisions", "case_id", fork.record.id),
    ).toBe(1);
    expect(
      await countRows(
        client,
        "demo_downstream_records",
        "case_id",
        fork.record.id,
      ),
    ).toBe(1);

    const templateStillAwaiting = await repo.getCaseById(templateId);
    expect(templateStillAwaiting?.status).toBe("awaiting_decision");
    expect(templateStillAwaiting?.decision ?? null).toBeNull();
  }, 120_000);
});

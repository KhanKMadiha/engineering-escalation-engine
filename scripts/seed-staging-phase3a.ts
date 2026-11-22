/**
 * Seed minimum fictional cases for Phase 3A staging:
 * Orchid (awaiting escalate), Meridian (insufficient), Vertex (approved + handoff).
 *
 * Usage:
 *   npx tsx scripts/seed-staging-phase3a.ts
 *
 * Loads `.env.staging` only. Refuses production.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { DecisionService } from "../src/lib/cases/decision-service";
import { SupabaseCaseRepository } from "../src/lib/supabase/supabase-case-repository";
import { PROTECTED_PRODUCTION_SUPABASE_REF } from "../src/lib/supabase/staging-guard";
import type {
  CreateCaseInput,
  EscalationEngineResult,
  StoredAnalysis,
} from "../src/types";

function loadEnvStaging(): void {
  const path = resolve(process.cwd(), ".env.staging");
  if (!existsSync(path)) {
    throw new Error("Missing .env.staging");
  }
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvStaging();
process.env.CASE_REPOSITORY = "supabase";

const url = process.env.SUPABASE_URL?.trim() ?? "";
let ref: string | null = null;
try {
  ref = new URL(url).hostname.split(".")[0] ?? null;
} catch {
  ref = null;
}
if (!ref || ref === PROTECTED_PRODUCTION_SUPABASE_REF) {
  console.error("Refusing seed: staging URL missing or production.");
  process.exit(1);
}

const client = createClient(
  process.env.SUPABASE_URL!.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const repo = new SupabaseCaseRepository(client);
const decisions = new DecisionService(repo);

const analysisEscalate: StoredAnalysis = {
  id: crypto.randomUUID(),
  aiResult: {
    assessedSeverity: "high",
    issueCategory: "integration",
    reproducibility: "confirmed",
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
  createdAt: new Date().toISOString(),
  assessmentVersion: 1,
  isCurrent: true,
};

const analysisInsufficient: StoredAnalysis = {
  ...analysisEscalate,
  id: crypto.randomUUID(),
  aiResult: {
    ...analysisEscalate.aiResult,
    assessedSeverity: "medium",
    reproducibility: "not_reproduced",
    suspectedProductDefect: false,
    reasoning: "Evidence incomplete for escalation.",
    missingEvidence: ["Complete SAML failure package"],
    recommendedNextSteps: ["Collect IdP logs"],
    aiEscalationAssessment: "insufficient_data",
  },
  evidenceCompletenessScore: 0.33,
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

async function seedTemplate(input: {
  createInput: CreateCaseInput;
  analysis: StoredAnalysis;
  result: EscalationEngineResult;
  status: "awaiting_decision" | "investigation_continues";
}) {
  const existing = (await repo.listCases({})).find(
    (c) => c.issueTitle === input.createInput.issueTitle,
  );
  if (existing) {
    return { id: existing.id, reused: true, status: existing.status };
  }
  const created = await repo.createCase(input.createInput);
  await repo.saveAnalysis(created.id, {
    ...input.analysis,
    id: crypto.randomUUID(),
  });
  await repo.saveEscalationResult(created.id, input.result);
  await repo.updateCaseStatus(created.id, "submitted");
  await repo.updateCaseStatus(created.id, "analyzing");
  await repo.updateCaseStatus(created.id, input.status);
  return { id: created.id, reused: false, status: input.status };
}

async function main() {
  const orchid = await seedTemplate({
    createInput: {
      customer: "[DEMO] Orchid Health",
      product: "SSO",
      severity: "high",
      issueTitle: "[DEMO] SAML SSO failing for some users",
      issueDescription:
        "Some users fail SAML SSO while peers on the same IdP succeed. Captured error: Signature validation failed (req-demo-saml-5520).",
      environment: "production",
      stepsToReproduce: "1. Attempt SSO login",
      expectedBehaviour: "Login succeeds",
      actualBehaviour: "Login fails with signature validation error",
      troubleshootingPerformed: "Captured SAML error",
      logsErrors: "Signature validation failed",
      requestIds: "req-demo-saml-5520",
      incidentTimestamp: null,
      affectedCustomerCount: 3,
    },
    analysis: analysisEscalate,
    result: escalate,
    status: "awaiting_decision",
  });

  const meridian = await seedTemplate({
    createInput: {
      customer: "[DEMO] Meridian Systems",
      product: "SSO",
      severity: "medium",
      issueTitle:
        "[DEMO] SSO login fails for some users after IdP certificate rotation",
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
    analysis: analysisInsufficient,
    result: insufficient,
    status: "investigation_continues",
  });

  const vertexRationale =
    "HTTP 504 gateway timeouts were reproduced in production, affecting multiple customer accounts. Request IDs and gateway logs were captured during troubleshooting. Engineering investigation is required to determine the underlying cause.";

  let vertex = await seedTemplate({
    createInput: {
      customer: "[DEMO] Vertex Media",
      product: "API Gateway",
      severity: "high",
      issueTitle: "[DEMO] Intermittent HTTP 504 Gateway Timeout Errors",
      issueDescription:
        "API requests intermittently return HTTP 504 errors in prod.",
      environment: "production",
      stepsToReproduce: "1. Issue repeated GET requests",
      expectedBehaviour: "HTTP 200",
      actualBehaviour:
        "Requests intermittently return HTTP 504 with elevated upstream latency.",
      troubleshootingPerformed: "Reproduced in production.",
      logsErrors: "upstream_duration_ms: 30112",
      requestIds: "req-demo-504-6618",
      incidentTimestamp: "2026-11-05T07:22:51.000Z",
      affectedCustomerCount: 5,
    },
    analysis: {
      ...analysisEscalate,
      aiResult: {
        ...analysisEscalate.aiResult,
        suspectedRootCause:
          "Upstream latency exceeding gateway timeout under peak load (inference; not proven).",
        reasoning:
          "High-severity production gateway timeouts with validated request IDs. Historical inference only.",
      },
    },
    result: { ...escalate, escalationScore: 100 },
    status: "awaiting_decision",
  });

  const currentVertex = await repo.getCaseById(vertex.id);
  if (!currentVertex?.decision) {
    await decisions.recordDecision({
      caseId: vertex.id,
      decision: "approved",
      rationale: vertexRationale,
      decidedBy: "support_engineer",
      isSimulated: false,
    });
  }

  const finalVertex = await repo.getCaseById(vertex.id);
  vertex = {
    id: vertex.id,
    reused: vertex.reused,
    status: finalVertex?.status ?? "escalated",
  };

  console.log(
    JSON.stringify(
      {
        stagingRef: ref,
        seeded: { orchid, meridian, vertex },
        vertexRationalePresent: Boolean(finalVertex?.decision?.rationale),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

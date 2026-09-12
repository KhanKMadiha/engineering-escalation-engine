import type { AnalysisModelClient } from "@/lib/analysis/analyze-case";
import { CaseOrchestrator } from "@/lib/cases/case-orchestrator";
import { CaseService } from "@/lib/cases/case-service";
import { DecisionService } from "@/lib/cases/decision-service";
import { validateCreateCaseInput } from "@/lib/cases/case-validators";
import {
  DEMO_CASE_DEFINITIONS,
  DEMO_CASE_MARKER,
  findDemoDefinitionByTitle,
  isLegacyDemoCustomerName,
  type DemoCaseKey,
} from "@/lib/demo/demo-cases";
import { buildDemoEventTimestamps } from "@/lib/demo/demo-timestamps";
import type { CaseRepository } from "@/lib/repositories/case-repository";
import type { EscalationRecommendation, SupportCase } from "@/types";

export type SeedDemoCaseResult = {
  key: DemoCaseKey;
  label: string;
  caseId: string;
  status: SupportCase["status"];
  escalationScore: number | null;
  recommendation: EscalationRecommendation | null;
  analysisOk: boolean;
  message?: string;
};

export type StaleDemoCaseSkip = {
  key: DemoCaseKey;
  issueTitle: string;
  caseId: string;
  existingProduct: string;
  expectedProduct: string;
  existingCustomer: string;
  expectedCustomer: string;
};

export type SeedDemoCasesResult = {
  seeded: SeedDemoCaseResult[];
  skippedExistingTitles: string[];
  /**
   * Existing demo rows skipped because the issue title already exists, but the
   * stored product/customer no longer matches the canonical seed.
   * Clear those records and reseed to pick up the updated demo data.
   */
  staleSkipped: StaleDemoCaseSkip[];
  /**
   * Other [DEMO]-marked cases still in the store that were not part of this seed
   * run (e.g. previous titles), or leftover rows still using retired placeholder
   * customer names. Clear them to avoid a mixed demo queue.
   */
  leftoverDemoTitles: string[];
};

/**
 * Demo analysis client — returns fixed structured payloads (no OpenAI).
 * Selects payload by issueTitle embedded in the analysis user prompt.
 */
export function createDemoAnalysisModelClient(): AnalysisModelClient {
  return {
    model: "demo-fixed-payload",
    async generateAnalysis(request) {
      const titleMatch = /"issueTitle"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(
        request.userPrompt,
      );
      const issueTitle = titleMatch
        ? titleMatch[1].replace(/\\"/g, '"')
        : undefined;
      if (!issueTitle) {
        throw new Error("Demo analysis client could not locate issueTitle");
      }
      const definition = findDemoDefinitionByTitle(issueTitle);
      if (!definition) {
        throw new Error(
          `No demo analysis payload for issueTitle: ${issueTitle}`,
        );
      }
      return structuredClone(definition.analysisPayload);
    },
  };
}

export type SeedDemoCasesOptions = {
  repository: CaseRepository;
  /**
   * When true, skip creating a demo case if one with the same issueTitle exists.
   * Default true — safe for re-runs against Supabase.
   */
  skipIfTitleExists?: boolean;
};

/**
 * Seeds the three fictional demo cases through CaseService + CaseOrchestrator.
 * Optional seed decisions use DecisionService (real transitions only).
 */
export async function seedDemoCases(
  options: SeedDemoCasesOptions,
): Promise<SeedDemoCasesResult> {
  const skipIfTitleExists = options.skipIfTitleExists ?? true;
  const caseService = new CaseService(options.repository);
  const orchestrator = new CaseOrchestrator(
    options.repository,
    createDemoAnalysisModelClient(),
  );
  const decisionService = new DecisionService(options.repository);

  const existingSummaries = await caseService.listCases();
  const existingByTitle = new Map(
    existingSummaries.map((c) => [c.issueTitle, c] as const),
  );
  const canonicalTitles = new Set(
    DEMO_CASE_DEFINITIONS.map((d) => d.createInput.issueTitle),
  );

  const seeded: SeedDemoCaseResult[] = [];
  const skippedExistingTitles: string[] = [];
  const staleSkipped: StaleDemoCaseSkip[] = [];

  for (const definition of DEMO_CASE_DEFINITIONS) {
    const existing = existingByTitle.get(definition.createInput.issueTitle);
    if (skipIfTitleExists && existing) {
      skippedExistingTitles.push(definition.createInput.issueTitle);
      const productMismatch =
        existing.product !== definition.createInput.product;
      const customerMismatch =
        existing.customer !== definition.createInput.customer;
      if (productMismatch || customerMismatch) {
        staleSkipped.push({
          key: definition.key,
          issueTitle: definition.createInput.issueTitle,
          caseId: existing.id,
          existingProduct: existing.product,
          expectedProduct: definition.createInput.product,
          existingCustomer: existing.customer,
          expectedCustomer: definition.createInput.customer,
        });
      }
      continue;
    }

    const validation = validateCreateCaseInput(definition.createInput);
    if (!validation.success) {
      throw new Error(
        `Demo case "${definition.key}" failed validation: ${validation.formError}`,
      );
    }

    const created = await caseService.createCase(validation.data);
    const analysis = await orchestrator.runAnalysisPipeline(created.id);

    if (!analysis.ok) {
      seeded.push({
        key: definition.key,
        label: definition.label,
        caseId: created.id,
        status: analysis.record?.status ?? created.status,
        escalationScore: null,
        recommendation: null,
        analysisOk: false,
        message: analysis.message,
      });
      continue;
    }

    let finalStatus = analysis.record.status;
    let finalScore = analysis.escalationResult.escalationScore;
    let finalRecommendation = analysis.escalationResult.recommendation;

    if (definition.seedDecision) {
      const decided = await decisionService.recordDecision({
        caseId: analysis.caseId,
        decision: definition.seedDecision.decision,
        rationale: definition.seedDecision.rationale,
      });
      finalStatus = decided.record.status;
      finalScore =
        decided.record.escalationResult?.escalationScore ?? finalScore;
      finalRecommendation =
        decided.record.escalationResult?.recommendation ?? finalRecommendation;
    }

    await applyFixedDemoTimestamps(
      options.repository,
      analysis.caseId,
      definition.reportedAt,
      definition.seedDecision?.decidedAt ?? null,
    );

    const refreshed = await caseService.getCaseById(analysis.caseId);
    finalStatus = refreshed.status;

    seeded.push({
      key: definition.key,
      label: definition.label,
      caseId: analysis.caseId,
      status: finalStatus,
      escalationScore: finalScore,
      recommendation: finalRecommendation,
      analysisOk: true,
    });
  }

  const leftoverDemoTitles = (await caseService.listCases())
    .filter(
      (item) =>
        (item.issueTitle.includes(DEMO_CASE_MARKER) ||
          item.customer.includes(DEMO_CASE_MARKER) ||
          isLegacyDemoCustomerName(item.customer)) &&
        !canonicalTitles.has(item.issueTitle),
    )
    .map((item) => item.issueTitle);

  return {
    seeded,
    skippedExistingTitles,
    staleSkipped,
    leftoverDemoTitles,
  };
}

async function applyFixedDemoTimestamps(
  repository: CaseRepository,
  caseId: string,
  reportedAt: string,
  decidedAt: string | null,
): Promise<void> {
  const record = await repository.getCaseWithDetails(caseId);
  if (!record) {
    throw new Error(`Demo seed could not load case ${caseId} for timestamps`);
  }

  const orderedEvents = [...record.events].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  const analysisEventCount = (() => {
    if (!decidedAt) {
      return orderedEvents.length;
    }
    const decisionIndex = orderedEvents.findIndex(
      (event) =>
        event.eventType === "human_decision_recorded" ||
        event.eventType === "decision_recorded",
    );
    return decisionIndex >= 0 ? decisionIndex : orderedEvents.length;
  })();

  const analysisEventTypes = orderedEvents
    .slice(0, analysisEventCount)
    .map((event) => event.eventType);
  const analysisTimestamps = buildDemoEventTimestamps(
    reportedAt,
    analysisEventTypes,
  );

  const eventCreatedAts = [...analysisTimestamps];
  if (decidedAt && analysisEventCount < orderedEvents.length) {
    const decisionEvents = orderedEvents.slice(analysisEventCount);
    const decisionBase = Date.parse(decidedAt);
    const STEP_MS = 3 * 60 * 1000;
    for (let i = 0; i < decisionEvents.length; i += 1) {
      eventCreatedAts.push(new Date(decisionBase + i * STEP_MS).toISOString());
    }
  }

  const analysisCompletedIndex = orderedEvents.findIndex(
    (event) => event.eventType === "analysis_completed",
  );
  const analysisCreatedAt =
    analysisCompletedIndex >= 0 && analysisCompletedIndex < eventCreatedAts.length
      ? eventCreatedAts[analysisCompletedIndex]!
      : eventCreatedAts[Math.min(2, eventCreatedAts.length - 1)]!;
  const updatedAt = eventCreatedAts[eventCreatedAts.length - 1]!;

  await repository.applyDemoSeedTimestamps(caseId, {
    createdAt: reportedAt,
    updatedAt,
    analysisCreatedAt: record.analysis ? analysisCreatedAt : null,
    eventCreatedAts,
    decisionDecidedAt: record.decision ? decidedAt : null,
    handoffCreatedAt: record.handoff ? decidedAt : null,
  });
}

/** Guard for CLI / HTTP seed entry points — never auto-run in production. */
export function assertDemoSeedAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === "production" && env.ALLOW_DEMO_SEED !== "1") {
    throw new Error(
      "Demo seed is blocked in production unless ALLOW_DEMO_SEED=1 is set explicitly.",
    );
  }
  if (env.ALLOW_DEMO_SEED !== "1") {
    throw new Error(
      "Demo seed requires explicit ALLOW_DEMO_SEED=1 (does not run automatically).",
    );
  }
}

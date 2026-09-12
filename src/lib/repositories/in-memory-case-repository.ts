import { createCaseEvent } from "@/lib/audit/case-events";
import type {
  CaseRepository,
  PersistDecisionOutcomeInput,
} from "@/lib/repositories/case-repository";
import { DuplicateDecisionError } from "@/lib/repositories/persistence-errors";
import type {
  CaseEvent,
  CaseListFilters,
  CaseRecord,
  CaseStatus,
  CreateCaseInput,
  EscalationEngineResult,
  EscalationHandoff,
  HumanDecision,
  StoredAnalysis,
  SupportCase,
  SupportCaseSummary,
} from "@/types";

function cloneRecord(record: CaseRecord): CaseRecord {
  return structuredClone(record);
}

function toSummary(record: CaseRecord): SupportCaseSummary {
  return {
    id: record.id,
    customer: record.customer,
    product: record.product,
    severity: record.severity,
    issueTitle: record.issueTitle,
    environment: record.environment,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    escalationRecommendation: record.escalationResult?.recommendation,
    escalationScore: record.escalationResult?.escalationScore,
  };
}

/**
 * In-memory CaseRepository (tests and local fallback).
 * Data is lost on process restart. Prefer SupabaseCaseRepository in production.
 */
export class InMemoryCaseRepository implements CaseRepository {
  private readonly cases = new Map<string, CaseRecord>();

  async createCase(input: CreateCaseInput): Promise<SupportCase> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const status: CaseStatus = "draft";

    const record: CaseRecord = {
      id,
      customer: input.customer,
      product: input.product,
      severity: input.severity,
      issueTitle: input.issueTitle,
      issueDescription: input.issueDescription,
      environment: input.environment,
      stepsToReproduce: input.stepsToReproduce,
      expectedBehaviour: input.expectedBehaviour,
      actualBehaviour: input.actualBehaviour,
      troubleshootingPerformed: input.troubleshootingPerformed,
      logsErrors: input.logsErrors,
      requestIds: input.requestIds,
      incidentTimestamp: input.incidentTimestamp ?? null,
      issueFirstObserved: input.issueFirstObserved?.trim()
        ? input.issueFirstObserved.trim()
        : null,
      affectedCustomerCount: input.affectedCustomerCount ?? null,
      status,
      createdAt: now,
      updatedAt: now,
      events: [
        createCaseEvent({
          caseId: id,
          eventType: "case_created",
          metadata: {
            status,
            severity: input.severity,
            environment: input.environment,
            customer: input.customer,
            product: input.product,
          },
          createdAt: now,
        }),
      ],
    };

    this.cases.set(id, record);
    return this.toSupportCase(record);
  }

  async getCaseById(id: string): Promise<CaseRecord | null> {
    const record = this.cases.get(id);
    return record ? cloneRecord(record) : null;
  }

  async getCaseWithDetails(id: string): Promise<CaseRecord | null> {
    return this.getCaseById(id);
  }

  async listCases(filters?: CaseListFilters): Promise<SupportCaseSummary[]> {
    const summaries = Array.from(this.cases.values())
      .filter((record) => {
        if (filters?.status && record.status !== filters.status) {
          return false;
        }
        if (filters?.severity && record.severity !== filters.severity) {
          return false;
        }
        return true;
      })
      .map(toSummary)
      .sort((a, b) => {
        const byReported = b.createdAt.localeCompare(a.createdAt);
        if (byReported !== 0) {
          return byReported;
        }
        return b.id.localeCompare(a.id);
      });

    return summaries;
  }

  async updateCaseStatus(id: string, status: CaseStatus): Promise<void> {
    const record = this.requireCase(id);
    const previousStatus = record.status;
    record.status = status;
    record.updatedAt = new Date().toISOString();
    record.events.push(
      createCaseEvent({
        caseId: id,
        eventType: "status_changed",
        metadata: { from: previousStatus, to: status },
      }),
    );
  }

  async saveAnalysis(caseId: string, analysis: StoredAnalysis): Promise<void> {
    const record = this.requireCase(caseId);
    record.analysis = structuredClone(analysis);
    record.updatedAt = new Date().toISOString();
  }

  async saveEscalationResult(
    caseId: string,
    result: EscalationEngineResult,
  ): Promise<void> {
    const record = this.requireCase(caseId);
    record.escalationResult = structuredClone(result);
    record.updatedAt = new Date().toISOString();
  }

  async saveHandoff(caseId: string, handoff: EscalationHandoff): Promise<void> {
    return this.saveEngineeringHandoff(caseId, handoff);
  }

  async saveDecision(caseId: string, decision: HumanDecision): Promise<void> {
    return this.saveHumanDecision(caseId, decision);
  }

  async saveEngineeringHandoff(
    caseId: string,
    handoff: EscalationHandoff,
  ): Promise<void> {
    const record = this.requireCase(caseId);
    record.handoff = structuredClone(handoff);
    record.updatedAt = new Date().toISOString();
  }

  async getEngineeringHandoff(
    caseId: string,
  ): Promise<EscalationHandoff | null> {
    const record = this.cases.get(caseId);
    return record?.handoff ? structuredClone(record.handoff) : null;
  }

  async saveHumanDecision(
    caseId: string,
    decision: HumanDecision,
  ): Promise<void> {
    const record = this.requireCase(caseId);
    if (record.decision) {
      throw new DuplicateDecisionError(caseId);
    }
    record.decision = structuredClone(decision);
    record.updatedAt = new Date().toISOString();
  }

  async getHumanDecision(caseId: string): Promise<HumanDecision | null> {
    const record = this.cases.get(caseId);
    return record?.decision ? structuredClone(record.decision) : null;
  }

  async appendEvent(caseId: string, event: CaseEvent): Promise<void> {
    const record = this.requireCase(caseId);
    if (event.caseId !== caseId) {
      throw new Error(
        `Event caseId (${event.caseId}) does not match target case (${caseId})`,
      );
    }
    record.events.push(structuredClone(event));
    record.updatedAt = new Date().toISOString();
  }

  async persistDecisionOutcome(
    input: PersistDecisionOutcomeInput,
  ): Promise<void> {
    const record = this.requireCase(input.caseId);
    if (record.decision) {
      throw new DuplicateDecisionError(input.caseId);
    }
    if (record.status !== "awaiting_decision") {
      throw new Error(
        `Case ${input.caseId} is not awaiting a human decision`,
      );
    }
    record.decision = structuredClone(input.decision);
    if (input.handoff) {
      record.handoff = structuredClone(input.handoff);
    }
    record.status = input.targetStatus;
    for (const event of input.events) {
      if (event.caseId !== input.caseId) {
        throw new Error(
          `Event caseId (${event.caseId}) does not match target case (${input.caseId})`,
        );
      }
      record.events.push(structuredClone(event));
    }
    record.updatedAt = new Date().toISOString();
  }

  async applyDemoSeedTimestamps(
    caseId: string,
    timestamps: {
      createdAt: string;
      updatedAt: string;
      analysisCreatedAt: string | null;
      eventCreatedAts: string[];
      decisionDecidedAt?: string | null;
      handoffCreatedAt?: string | null;
    },
  ): Promise<void> {
    const record = this.requireCase(caseId);
    const ordered = [...record.events].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    if (ordered.length !== timestamps.eventCreatedAts.length) {
      throw new Error(
        `Demo timestamp rewrite expected ${ordered.length} events, got ${timestamps.eventCreatedAts.length}`,
      );
    }
    record.createdAt = timestamps.createdAt;
    record.updatedAt = timestamps.updatedAt;
    if (record.analysis && timestamps.analysisCreatedAt) {
      record.analysis.createdAt = timestamps.analysisCreatedAt;
    }
    if (record.decision && timestamps.decisionDecidedAt) {
      record.decision.decidedAt = timestamps.decisionDecidedAt;
    }
    if (record.handoff && timestamps.handoffCreatedAt) {
      record.handoff.createdAt = timestamps.handoffCreatedAt;
    }
    for (let i = 0; i < ordered.length; i += 1) {
      ordered[i].createdAt = timestamps.eventCreatedAts[i]!;
    }
  }

  /** Test/helper: clear all stored cases. */
  clear(): void {
    this.cases.clear();
  }

  /** Test/helper: number of stored cases. */
  size(): number {
    return this.cases.size;
  }

  private requireCase(id: string): CaseRecord {
    const record = this.cases.get(id);
    if (!record) {
      throw new Error(`Case not found: ${id}`);
    }
    return record;
  }

  private toSupportCase(record: CaseRecord): SupportCase {
    return {
      id: record.id,
      customer: record.customer,
      product: record.product,
      severity: record.severity,
      issueTitle: record.issueTitle,
      issueDescription: record.issueDescription,
      environment: record.environment,
      stepsToReproduce: record.stepsToReproduce,
      expectedBehaviour: record.expectedBehaviour,
      actualBehaviour: record.actualBehaviour,
      troubleshootingPerformed: record.troubleshootingPerformed,
      logsErrors: record.logsErrors,
      requestIds: record.requestIds,
      incidentTimestamp: record.incidentTimestamp,
      issueFirstObserved: record.issueFirstObserved,
      affectedCustomerCount: record.affectedCustomerCount,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

/** Process-local singleton for the Phase 1 in-memory store. */
const IN_MEMORY_REPO_GLOBAL_KEY = "__eee_in_memory_case_repository__" as const;

type InMemoryRepoGlobal = {
  [IN_MEMORY_REPO_GLOBAL_KEY]?: InMemoryCaseRepository;
};

/**
 * Returns the shared in-memory repository for this Node process.
 *
 * Uses `globalThis` (not a module-scoped `let`) so Next.js App Router RSC
 * and Route Handler bundles — which can evaluate this module twice — still
 * share one store. Without this, demo seed via `/api/demo/seed` and the
 * dashboard at `/` can observe different empty maps.
 */
export function getInMemoryCaseRepository(): InMemoryCaseRepository {
  const globalStore = globalThis as unknown as InMemoryRepoGlobal;
  if (!globalStore[IN_MEMORY_REPO_GLOBAL_KEY]) {
    globalStore[IN_MEMORY_REPO_GLOBAL_KEY] = new InMemoryCaseRepository();
  }
  return globalStore[IN_MEMORY_REPO_GLOBAL_KEY];
}

/** Resets the singleton (tests / local dev only). */
export function resetInMemoryCaseRepository(): void {
  const globalStore = globalThis as unknown as InMemoryRepoGlobal;
  delete globalStore[IN_MEMORY_REPO_GLOBAL_KEY];
}

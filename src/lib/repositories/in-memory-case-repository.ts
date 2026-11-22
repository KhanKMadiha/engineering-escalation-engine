import { createCaseEvent } from "@/lib/audit/case-events";
import { nextAssessmentVersion } from "@/lib/cases/assessment-versioning";
import {
  assertCanCloneDemoTemplate,
  templateHasApprovedHandoff,
} from "@/lib/demo/demo-case-access";
import { isDemoTemplateCase } from "@/lib/demo/demo-workspace";
import { getInMemoryTechnicalEvidenceRepository } from "@/lib/repositories/in-memory-technical-evidence-repository";
import type {
  CaseRepository,
  PersistDecisionOutcomeInput,
} from "@/lib/repositories/case-repository";
import {
  HandoffAlreadyExistsError,
  StaleAssessmentError,
} from "@/lib/repositories/persistence-errors";
import type {
  CaseEvent,
  CaseListFilters,
  CaseRecord,
  CaseStatus,
  CreateCaseInput,
  DemoDownstreamDestination,
  DemoDownstreamRecord,
  DemoWorkspace,
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
    demoWorkspaceId: record.demoWorkspaceId ?? null,
    clonedFromCaseId: record.clonedFromCaseId ?? null,
  };
}

/**
 * In-memory CaseRepository (tests and local fallback).
 * Data is lost on process restart. Prefer SupabaseCaseRepository in production.
 */
export class InMemoryCaseRepository implements CaseRepository {
  private readonly cases = new Map<string, CaseRecord>();
  private readonly workspaces = new Map<string, DemoWorkspace>();
  private readonly downstreamRecords = new Map<string, DemoDownstreamRecord>();
  /** Serialises clone-on-write per workspace+template to avoid duplicate forks. */
  private readonly cloneLocks = new Map<string, Promise<CaseRecord>>();
  /** Serialises downstream create per workspace+case+destination. */
  private readonly downstreamLocks = new Map<
    string,
    Promise<DemoDownstreamRecord>
  >();

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
      sourceSystem: input.sourceSystem ?? null,
      externalTicketId: input.externalTicketId?.trim()
        ? input.externalTicketId.trim()
        : null,
      externalUrl: input.externalUrl?.trim() ? input.externalUrl.trim() : null,
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

  async findByExternalTicket(
    sourceSystem: string,
    externalTicketId: string,
  ): Promise<SupportCase | null> {
    for (const record of this.cases.values()) {
      if (
        record.sourceSystem === sourceSystem &&
        record.externalTicketId === externalTicketId
      ) {
        return this.toSupportCase(record);
      }
    }
    return null;
  }

  async getCaseById(id: string): Promise<CaseRecord | null> {
    const record = this.cases.get(id);
    return record ? cloneRecord(record) : null;
  }

  async getCaseWithDetails(id: string): Promise<CaseRecord | null> {
    return this.getCaseById(id);
  }

  async listCases(filters?: CaseListFilters): Promise<SupportCaseSummary[]> {
    const includeTemplates = filters?.includeSharedTemplates !== false;
    const workspaceId = filters?.demoWorkspaceId;

    const summaries = Array.from(this.cases.values())
      .filter((record) => {
        if (filters?.status && record.status !== filters.status) {
          return false;
        }
        if (filters?.severity && record.severity !== filters.severity) {
          return false;
        }

        const isTemplate = isDemoTemplateCase(record);
        if (isTemplate) {
          return includeTemplates;
        }
        // Private forks: only the owning workspace may see them.
        if (!workspaceId || record.demoWorkspaceId !== workspaceId) {
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
    const version = nextAssessmentVersion(record.currentAssessmentVersion);

    if (record.analysis) {
      const prior = {
        ...structuredClone(record.analysis),
        isCurrent: false,
      };
      record.analysisHistory = [...(record.analysisHistory ?? []), prior];
    }

    record.analysis = {
      ...structuredClone(analysis),
      assessmentVersion: version,
      isCurrent: true,
    };
    record.currentAssessmentVersion = version;
    record.updatedAt = new Date().toISOString();
  }

  async saveEscalationResult(
    caseId: string,
    result: EscalationEngineResult,
  ): Promise<void> {
    const record = this.requireCase(caseId);
    const version = record.currentAssessmentVersion ?? 1;

    if (record.escalationResult) {
      const prior = {
        ...structuredClone(record.escalationResult),
        isCurrent: false,
      };
      record.escalationHistory = [...(record.escalationHistory ?? []), prior];
    }

    record.escalationResult = {
      ...structuredClone(result),
      assessmentVersion: version,
      isCurrent: true,
    };
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
    const stored = structuredClone(decision);
    record.decisions = [...(record.decisions ?? []), stored];
    record.decision = stored;
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
    if (input.handoff && record.handoff) {
      throw new HandoffAlreadyExistsError(input.caseId);
    }

    const expectedVersion =
      input.expectedAssessmentVersion ??
      input.decision.assessmentVersion ??
      record.currentAssessmentVersion ??
      1;
    const currentVersion = record.currentAssessmentVersion ?? null;

    if (currentVersion != null && currentVersion !== expectedVersion) {
      throw new StaleAssessmentError(
        input.caseId,
        expectedVersion,
        currentVersion,
      );
    }

    const isException = input.decision.isException === true;
    const eligible =
      record.status === "awaiting_decision" ||
      (isException && record.status === "investigation_continues");
    if (!eligible) {
      throw new Error(
        `Case ${input.caseId} is not eligible for a human decision from status "${record.status}"`,
      );
    }

    const storedDecision = structuredClone(input.decision);
    record.decisions = [...(record.decisions ?? []), storedDecision];
    record.decision = storedDecision;
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

  async createDemoWorkspace(workspace: DemoWorkspace): Promise<DemoWorkspace> {
    const stored = structuredClone(workspace);
    this.workspaces.set(stored.id, stored);
    return structuredClone(stored);
  }

  async getDemoWorkspace(id: string): Promise<DemoWorkspace | null> {
    const workspace = this.workspaces.get(id);
    return workspace ? structuredClone(workspace) : null;
  }

  async touchDemoWorkspace(id: string, lastActiveAt: string): Promise<void> {
    const workspace = this.workspaces.get(id);
    if (!workspace) {
      throw new Error(`Demo workspace not found: ${id}`);
    }
    workspace.lastActiveAt = lastActiveAt;
  }

  async purgeExpiredDemoWorkspaces(nowIso?: string): Promise<number> {
    const now = new Date(nowIso ?? new Date().toISOString()).getTime();
    const evidenceRepo = getInMemoryTechnicalEvidenceRepository();
    let removed = 0;
    for (const [id, workspace] of this.workspaces) {
      if (new Date(workspace.expiresAt).getTime() <= now) {
        for (const [recordId, downstream] of this.downstreamRecords) {
          if (downstream.demoWorkspaceId === id) {
            this.downstreamRecords.delete(recordId);
          }
        }
        for (const [caseId, record] of this.cases) {
          if (record.demoWorkspaceId === id) {
            const evidence = await evidenceRepo.listByCaseId(caseId);
            for (const item of evidence) {
              await evidenceRepo.delete(item.id);
            }
            this.cases.delete(caseId);
          }
        }
        this.workspaces.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  async saveDemoDownstreamRecord(
    record: DemoDownstreamRecord,
  ): Promise<DemoDownstreamRecord> {
    const lockKey = `${record.demoWorkspaceId}:${record.caseId}:${record.destination}`;
    const inFlight = this.downstreamLocks.get(lockKey);
    if (inFlight) {
      return inFlight.then((saved) => structuredClone(saved));
    }

    const run = (async () => {
      const existing = [...this.downstreamRecords.values()].find(
        (row) =>
          row.demoWorkspaceId === record.demoWorkspaceId &&
          row.caseId === record.caseId &&
          row.destination === record.destination,
      );
      if (existing) {
        return structuredClone(existing);
      }
      const stored = structuredClone(record);
      this.downstreamRecords.set(stored.id, stored);
      return structuredClone(stored);
    })();

    this.downstreamLocks.set(lockKey, run);
    try {
      return await run;
    } finally {
      this.downstreamLocks.delete(lockKey);
    }
  }

  async getDemoDownstreamRecord(input: {
    workspaceId: string;
    caseId: string;
    destination: DemoDownstreamDestination;
  }): Promise<DemoDownstreamRecord | null> {
    const found = [...this.downstreamRecords.values()].find(
      (row) =>
        row.demoWorkspaceId === input.workspaceId &&
        row.caseId === input.caseId &&
        row.destination === input.destination,
    );
    return found ? structuredClone(found) : null;
  }

  async listDemoDownstreamRecordsForCase(input: {
    workspaceId: string;
    caseId: string;
  }): Promise<DemoDownstreamRecord[]> {
    return [...this.downstreamRecords.values()]
      .filter(
        (row) =>
          row.demoWorkspaceId === input.workspaceId &&
          row.caseId === input.caseId,
      )
      .map((row) => structuredClone(row))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getDemoDownstreamRecordById(
    id: string,
    workspaceId: string,
  ): Promise<DemoDownstreamRecord | null> {
    const found = this.downstreamRecords.get(id);
    if (!found || found.demoWorkspaceId !== workspaceId) {
      return null;
    }
    return structuredClone(found);
  }

  /**
   * Copy-on-write fork into a visitor workspace.
   * Copies case + current assessment + evidence metadata.
   * Approved templates also copy decision/handoff with original provenance
   * (no second approval). Unrelated event history is not copied.
   */
  async cloneCaseIntoDemoWorkspace(
    templateCaseId: string,
    workspaceId: string,
  ): Promise<CaseRecord> {
    const lockKey = `${workspaceId}:${templateCaseId}`;
    const inFlight = this.cloneLocks.get(lockKey);
    if (inFlight) {
      return inFlight.then((record) => cloneRecord(record));
    }

    const run = this.cloneCaseIntoDemoWorkspaceLocked(
      templateCaseId,
      workspaceId,
    );
    this.cloneLocks.set(lockKey, run);
    try {
      return await run;
    } finally {
      this.cloneLocks.delete(lockKey);
    }
  }

  private async cloneCaseIntoDemoWorkspaceLocked(
    templateCaseId: string,
    workspaceId: string,
  ): Promise<CaseRecord> {
    if (!this.workspaces.has(workspaceId)) {
      throw new Error(`Demo workspace not found: ${workspaceId}`);
    }

    const existingFork = [...this.cases.values()].find(
      (record) =>
        record.demoWorkspaceId === workspaceId &&
        record.clonedFromCaseId === templateCaseId,
    );
    if (existingFork) {
      return cloneRecord(existingFork);
    }

    const template = this.requireCase(templateCaseId);
    assertCanCloneDemoTemplate(template);

    const now = new Date().toISOString();
    const forkId = crypto.randomUUID();
    const preserveApproval = templateHasApprovedHandoff(template);

    let decision = undefined as CaseRecord["decision"];
    let decisions: CaseRecord["decisions"] = [];
    let handoff = undefined as CaseRecord["handoff"];

    if (preserveApproval && template.decision) {
      const decisionId = crypto.randomUUID();
      decision = {
        ...structuredClone(template.decision),
        id: decisionId,
        caseId: forkId,
        // Preserve original reviewer identity — not a visitor approval.
        isSimulated: false,
      };
      decisions = [decision];
      if (template.handoff) {
        handoff = {
          ...structuredClone(template.handoff),
          id: crypto.randomUUID(),
          caseId: forkId,
          decisionId,
          isSimulated: false,
        };
      }
    }

    const fork: CaseRecord = {
      ...structuredClone(this.toSupportCase(template)),
      id: forkId,
      createdAt: now,
      updatedAt: now,
      status: template.status,
      demoWorkspaceId: workspaceId,
      clonedFromCaseId: templateCaseId,
      currentAssessmentVersion: template.currentAssessmentVersion ?? 1,
      assessmentInputFingerprint: template.assessmentInputFingerprint ?? null,
      analysis: template.analysis
        ? {
            ...structuredClone(template.analysis),
            id: crypto.randomUUID(),
            assessmentVersion: template.analysis.assessmentVersion ?? 1,
            isCurrent: true,
          }
        : undefined,
      escalationResult: template.escalationResult
        ? {
            ...structuredClone(template.escalationResult),
            assessmentVersion:
              template.escalationResult.assessmentVersion ??
              template.currentAssessmentVersion ??
              1,
            isCurrent: true,
          }
        : undefined,
      decision,
      decisions,
      handoff,
      analysisHistory: [],
      escalationHistory: [],
      events: [
        createCaseEvent({
          caseId: forkId,
          eventType: "case_created",
          metadata: {
            clonedFromCaseId: templateCaseId,
            demoWorkspace: true,
            preservedApproval: preserveApproval,
            originalDecisionId: template.decision?.id ?? null,
            originalHandoffId: template.handoff?.id ?? null,
          },
          createdAt: now,
        }),
      ],
      technicalEvidence: [],
    };

    this.cases.set(forkId, fork);

    const evidenceRepo = getInMemoryTechnicalEvidenceRepository();
    const templateEvidence = await evidenceRepo.listByCaseId(templateCaseId);
    for (const item of templateEvidence) {
      // Metadata only — do not duplicate attachment bytes for demo fiction.
      await evidenceRepo.create({
        caseId: forkId,
        evidenceType: item.evidenceType,
        title: item.title,
        service: item.service,
        body: item.body,
        caption: item.caption,
        capturedAt: item.capturedAt,
        requestId: item.requestId,
        traceId: item.traceId,
        externalUrl: item.externalUrl,
        source: item.source,
        verificationStatus: item.verificationStatus,
        sortOrder: item.sortOrder,
      });
    }

    return cloneRecord(fork);
  }

  /** Test/helper: clear all stored cases. */
  clear(): void {
    this.cases.clear();
    this.workspaces.clear();
    this.downstreamRecords.clear();
    this.cloneLocks.clear();
    this.downstreamLocks.clear();
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
      sourceSystem: record.sourceSystem ?? null,
      externalTicketId: record.externalTicketId ?? null,
      externalUrl: record.externalUrl ?? null,
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

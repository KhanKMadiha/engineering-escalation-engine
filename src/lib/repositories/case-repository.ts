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

/**
 * Atomic persistence payload for human decision outcomes.
 * Business rules stay in DecisionService; repositories guarantee consistency.
 */
export type PersistDecisionOutcomeInput = {
  caseId: string;
  decision: HumanDecision;
  /** Present only when decision is approved. */
  handoff: EscalationHandoff | null;
  targetStatus: Extract<CaseStatus, "escalated" | "investigation_continues">;
  events: CaseEvent[];
  /**
   * Must match the case's current assessment version (stale-guard).
   * Defaults to decision.assessmentVersion when omitted.
   */
  expectedAssessmentVersion?: number;
};

/**
 * Persistence boundary for support cases.
 * Implementations: InMemoryCaseRepository, SupabaseCaseRepository.
 * Domain services and Server Actions must depend on this interface only.
 */
export interface CaseRepository {
  createCase(input: CreateCaseInput): Promise<SupportCase>;
  getCaseById(id: string): Promise<CaseRecord | null>;
  /**
   * Lookup for ticket-import idempotency.
   * Returns null when no matching imported case exists.
   */
  findByExternalTicket(
    sourceSystem: string,
    externalTicketId: string,
  ): Promise<SupportCase | null>;
  listCases(filters?: CaseListFilters): Promise<SupportCaseSummary[]>;
  updateCaseStatus(id: string, status: CaseStatus): Promise<void>;
  saveAnalysis(caseId: string, analysis: StoredAnalysis): Promise<void>;
  saveEscalationResult(
    caseId: string,
    result: EscalationEngineResult,
  ): Promise<void>;

  /** @deprecated Prefer saveEngineeringHandoff */
  saveHandoff(caseId: string, handoff: EscalationHandoff): Promise<void>;
  /** @deprecated Prefer saveHumanDecision */
  saveDecision(caseId: string, decision: HumanDecision): Promise<void>;

  saveHumanDecision(caseId: string, decision: HumanDecision): Promise<void>;
  getHumanDecision(caseId: string): Promise<HumanDecision | null>;
  saveEngineeringHandoff(
    caseId: string,
    handoff: EscalationHandoff,
  ): Promise<void>;
  getEngineeringHandoff(caseId: string): Promise<EscalationHandoff | null>;

  appendEvent(caseId: string, event: CaseEvent): Promise<void>;
  getCaseWithDetails(id: string): Promise<CaseRecord | null>;

  /**
   * Persist decision (+ optional handoff), target status, and audit events
   * as one logical unit. Used by DecisionService for approve/reject.
   */
  persistDecisionOutcome(input: PersistDecisionOutcomeInput): Promise<void>;

  /**
   * Demo seed only: rewrite case / analysis / event timestamps for reproducible
   * fixtures. Does not change scores, recommendations, or workflow state.
   */
  applyDemoSeedTimestamps(
    caseId: string,
    timestamps: {
      createdAt: string;
      updatedAt: string;
      analysisCreatedAt: string | null;
      /** Must align 1:1 with the case's events sorted by current createdAt. */
      eventCreatedAts: string[];
      decisionDecidedAt?: string | null;
      handoffCreatedAt?: string | null;
    },
  ): Promise<void>;

  /**
   * Approach D — optional until workspace migration is applied + implemented.
   * Implementations may throw if demo workspaces are not supported yet.
   */
  createDemoWorkspace?(workspace: DemoWorkspace): Promise<DemoWorkspace>;
  getDemoWorkspace?(id: string): Promise<DemoWorkspace | null>;
  touchDemoWorkspace?(id: string, lastActiveAt: string): Promise<void>;
  /**
   * Copy-on-write clone of a shared template into a visitor workspace.
   * Copies case + current analysis/escalation + evidence metadata.
   * Approved templates also copy decision/handoff with original provenance.
   * Does not copy unrelated event history or attachment bytes.
   * Idempotent per (workspaceId, templateCaseId) via unique index.
   */
  cloneCaseIntoDemoWorkspace?(
    templateCaseId: string,
    workspaceId: string,
  ): Promise<CaseRecord>;
  /** Deletes expired workspaces; forks cascade. Returns number removed. */
  purgeExpiredDemoWorkspaces?(nowIso?: string): Promise<number>;

  /**
   * Phase 2B — simulated Jira/Rootly persistence (optional until migration).
   * Idempotent per (workspaceId, caseId, destination).
   */
  saveDemoDownstreamRecord?(
    record: DemoDownstreamRecord,
  ): Promise<DemoDownstreamRecord>;
  getDemoDownstreamRecord?(input: {
    workspaceId: string;
    caseId: string;
    destination: DemoDownstreamDestination;
  }): Promise<DemoDownstreamRecord | null>;
  listDemoDownstreamRecordsForCase?(input: {
    workspaceId: string;
    caseId: string;
  }): Promise<DemoDownstreamRecord[]>;
  getDemoDownstreamRecordById?(
    id: string,
    workspaceId: string,
  ): Promise<DemoDownstreamRecord | null>;
}
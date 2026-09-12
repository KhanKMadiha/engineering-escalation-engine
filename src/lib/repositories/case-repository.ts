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
};

/**
 * Persistence boundary for support cases.
 * Implementations: InMemoryCaseRepository, SupabaseCaseRepository.
 * Domain services and Server Actions must depend on this interface only.
 */
export interface CaseRepository {
  createCase(input: CreateCaseInput): Promise<SupportCase>;
  getCaseById(id: string): Promise<CaseRecord | null>;
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
}

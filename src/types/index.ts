import type { ProvenanceSource } from "@/lib/provenance/types";
import type {
  CaseAnalysisResult,
  EvidenceIdentifiedItem,
} from "@/lib/analysis/analysis-schema";
import type { TechnicalEvidenceRecord } from "@/lib/evidence/evidence-types";

export type Severity = "critical" | "high" | "medium" | "low";

export type Environment =
  | "production"
  | "staging"
  | "development"
  | "unknown";

export type CaseStatus =
  | "draft"
  | "submitted"
  | "analyzing"
  | "awaiting_decision"
  | "escalated"
  | "investigation_continues"
  | "closed";

export type EscalationRecommendation =
  | "escalate"
  | "continue_investigation"
  | "insufficient_evidence";

export type HumanDecisionType = "approved" | "rejected";

export type CaseEventType =
  | "case_created"
  | "case_submitted"
  | "analysis_started"
  | "analysis_completed"
  | "analysis_failed"
  | "escalation_evaluated"
  | "escalation_evaluation_failed"
  | "human_decision_recorded"
  | "engineering_handoff_created"
  | "decision_recorded"
  | "demo_rationale_corrected"
  | "demo_wording_corrected"
  | "status_changed"
  | "ticket_imported"
  | "technical_evidence_added"
  | "technical_evidence_updated"
  | "technical_evidence_deleted"
  | "technical_evidence_attachment_added"
  | "technical_evidence_attachment_deleted";

export type CaseSourceSystem = "manual" | "freshdesk" | "demo_freshdesk";

export type SupportCase = {
  id: string;
  customer: string;
  product: string;
  severity: Severity;
  issueTitle: string;
  issueDescription: string;
  environment: Environment;
  /** Customer/support-provided; empty string when not provided. */
  stepsToReproduce: string;
  /** Customer/support-provided; empty string when not provided. */
  expectedBehaviour: string;
  /** Customer/support-provided; empty string when not provided. */
  actualBehaviour: string;
  troubleshootingPerformed: string;
  logsErrors: string;
  requestIds: string;
  /**
   * Optional precise incident datetime (ISO). Kept for API/compat.
   * Do not invent this from approximate timeframes.
   */
  incidentTimestamp: string | null;
  /**
   * Optional approximate "issue first observed" timeframe (customer/support text).
   * Not a parsed datetime — may be phrases like "This morning".
   */
  issueFirstObserved: string | null;
  affectedCustomerCount: number | null;
  /** Intake provenance — null/manual for classic form creates. */
  sourceSystem?: CaseSourceSystem | null;
  /** External ticket id when imported; null for manual cases. */
  externalTicketId?: string | null;
  /** Optional deep link to the source ticket. */
  externalUrl?: string | null;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateCaseInput = {
  customer: string;
  product: string;
  severity: Severity;
  issueTitle: string;
  issueDescription: string;
  environment: Environment;
  /** Empty string when not provided. */
  stepsToReproduce: string;
  /** Empty string when not provided. */
  expectedBehaviour: string;
  /** Empty string when not provided. */
  actualBehaviour: string;
  troubleshootingPerformed: string;
  logsErrors: string;
  requestIds: string;
  /** Optional precise ISO datetime. Do not pass approximate free text here. */
  incidentTimestamp?: string | null;
  /** Optional approximate timeframe text. Not parsed into a timestamp. */
  issueFirstObserved?: string | null;
  affectedCustomerCount?: number | null;
  sourceSystem?: CaseSourceSystem | null;
  externalTicketId?: string | null;
  externalUrl?: string | null;
};

export type SupportCaseSummary = {
  id: string;
  customer: string;
  product: string;
  severity: Severity;
  issueTitle: string;
  environment: Environment;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  escalationRecommendation?: EscalationRecommendation;
  escalationScore?: number;
  /** Present on visitor forks; null/undefined for shared templates. */
  demoWorkspaceId?: string | null;
  /** Template case id when this summary is a visitor fork. */
  clonedFromCaseId?: string | null;
};

export type CaseListFilters = {
  status?: CaseStatus;
  severity?: Severity;
  /**
   * When set, include private forks owned by this workspace.
   * Other visitors' forks are never returned.
   */
  demoWorkspaceId?: string | null;
  /**
   * Include shared templates (`demo_workspace_id IS NULL`). Default true.
   */
  includeSharedTemplates?: boolean;
};

export type CaseEvent = {
  id: string;
  caseId: string;
  eventType: CaseEventType;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

/**
 * Stored AI analysis for a support case.
 * Evidence in aiResult.evidenceIdentified is validated only.
 * assessmentVersion / isCurrent support reassessment history (Increment 2+).
 */
export type StoredAnalysis = {
  id: string;
  aiResult: CaseAnalysisResult;
  validatedEvidence: EvidenceIdentifiedItem[];
  rejectedEvidence: Array<
    EvidenceIdentifiedItem & {
      reason: string;
    }
  >;
  evidenceCompletenessScore: number;
  provenance?: Record<string, ProvenanceSource>;
  analysisWarnings?: string[];
  model: string;
  promptVersion: string;
  createdAt: string;
  /** Monotonic per case; first assessment is 1. Defaults to 1 when omitted. */
  assessmentVersion?: number;
  /** Exactly one analysis per case should be current. Defaults to true when omitted. */
  isCurrent?: boolean;
};

export type EscalationEngineResult = {
  escalationScore: number;
  recommendation: EscalationRecommendation;
  contributingFactors: Array<{
    signal: string;
    weight: number;
    direction: "increases" | "decreases" | "neutral";
    reason: string;
  }>;
  recommendationReasons: string[];
  source: "deterministic_engine";
  /** Set when persisted; pairs with StoredAnalysis.assessmentVersion. */
  assessmentVersion?: number;
  isCurrent?: boolean;
};

export type EscalationHandoffEvidenceItem = {
  description: string;
  sourceField: string;
  quotedExcerpt: string;
  source: "extracted_evidence";
};

/**
 * Deterministic engineering-ready escalation handoff.
 * Built only from validated case, analysis, engine, and human decision data.
 */
export type EscalationHandoff = {
  id: string;
  caseId: string;
  title: string;
  summary: string;
  customerImpact: string;
  environment: string;
  reportedSeverity: Severity;
  affectedCustomerCount: number | null;
  issueCategory: string;
  stepsToReproduce: string;
  expectedBehaviour: string;
  actualBehaviour: string;
  reproducibility: string;
  troubleshootingPerformed: string;
  evidence: EscalationHandoffEvidenceItem[];
  missingEvidence: string[];
  suspectedRootCause: string;
  escalationScore: number;
  escalationRecommendation: EscalationRecommendation;
  decisionRationale: string;
  createdAt: string;
  source: "engineering_handoff";
  /** Set when handoff was created from a simulated demo approval. */
  isSimulated?: boolean;
  /** Decision that authorized this handoff, when known. */
  decisionId?: string | null;
};

export type HumanDecision = {
  id: string;
  caseId: string;
  decision: HumanDecisionType;
  rationale: string;
  decidedAt: string;
  decidedBy: string;
  escalationScoreAtDecision: number;
  recommendationAtDecision: EscalationRecommendation;
  source: "human_decision";
  /** Assessment version this decision was recorded against. Defaults to 1. */
  assessmentVersion?: number;
  /** True when approving despite a non-escalate engine recommendation. */
  isException?: boolean;
  /** Required when isException is true (presentation + persistence). */
  exceptionReason?: string | null;
  /**
   * Portfolio visitor simulated decision (Approach D).
   * false/omitted = organisational or seed decision on a template/local run.
   */
  isSimulated?: boolean;
};

/**
 * Anonymous demo workspace (Approach D). Not a user account.
 * Cookie may store `id` only — never show in UI.
 */
export type DemoWorkspace = {
  id: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
};

export type DemoDownstreamDestination = "jira" | "rootly";

/**
 * Persistent simulated Jira / Rootly record (Phase 2B).
 * Scoped to an anonymous workspace — never an external ticket.
 */
export type DemoDownstreamRecord = {
  id: string;
  demoWorkspaceId: string;
  caseId: string;
  destination: DemoDownstreamDestination;
  /** Deterministic demo reference (ENG-DEMO-* / INC-DEMO-*). */
  externalReference: string;
  /** Server-built preview/result payload for refresh display. */
  payload: Record<string, unknown>;
  handoffId: string | null;
  createdAt: string;
};

export type CaseRecord = SupportCase & {
  analysis?: StoredAnalysis;
  escalationResult?: EscalationEngineResult;
  handoff?: EscalationHandoff;
  /** Latest human decision (convenience); full history in `decisions`. */
  decision?: HumanDecision;
  /** All recorded human decisions, oldest → newest. */
  decisions?: HumanDecision[];
  /** Prior analyses when reassessment has run (excludes current). */
  analysisHistory?: StoredAnalysis[];
  /** Prior escalation results when reassessment has run (excludes current). */
  escalationHistory?: EscalationEngineResult[];
  /** Current assessment version pointer (1-based). */
  currentAssessmentVersion?: number | null;
  /** Fingerprint of inputs used for the current assessment (reassessment guard). */
  assessmentInputFingerprint?: string | null;
  /**
   * NULL = shared fictional template (immutable to visitors).
   * Set = copy-on-write fork owned by an anonymous demo workspace.
   */
  demoWorkspaceId?: string | null;
  /** Template case id when this record is a visitor fork. */
  clonedFromCaseId?: string | null;
  events: CaseEvent[];
  /**
   * Phase B structured technical evidence (optional).
   * Loaded separately from AI analysis; survives reassessment.
   */
  technicalEvidence?: TechnicalEvidenceRecord[];
};

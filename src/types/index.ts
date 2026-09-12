import type { ProvenanceSource } from "@/lib/provenance/types";
import type {
  CaseAnalysisResult,
  EvidenceIdentifiedItem,
} from "@/lib/analysis/analysis-schema";

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
  | "status_changed";

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
};

export type CaseListFilters = {
  status?: CaseStatus;
  severity?: Severity;
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
};

export type CaseRecord = SupportCase & {
  analysis?: StoredAnalysis;
  escalationResult?: EscalationEngineResult;
  handoff?: EscalationHandoff;
  decision?: HumanDecision;
  events: CaseEvent[];
};

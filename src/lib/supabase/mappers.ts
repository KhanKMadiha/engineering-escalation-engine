/**
 * Pure mappers between Postgres/Supabase row shapes and domain types.
 * Keep all database snake_case / JSONB details inside this module.
 */

import type {
  CaseEvent,
  CaseEventType,
  CaseRecord,
  CaseStatus,
  CreateCaseInput,
  Environment,
  EscalationEngineResult,
  EscalationHandoff,
  EscalationRecommendation,
  HumanDecision,
  Severity,
  StoredAnalysis,
  SupportCase,
  SupportCaseSummary,
} from "@/types";

export type SupportCaseRow = {
  id: string;
  customer: string;
  product: string;
  severity: Severity;
  issue_title: string;
  issue_description: string;
  environment: Environment;
  steps_to_reproduce: string | null;
  expected_behaviour: string | null;
  actual_behaviour: string | null;
  troubleshooting_performed: string;
  logs_errors: string;
  request_ids: string;
  incident_timestamp: string | null;
  issue_first_observed: string | null;
  affected_customer_count: number | null;
  status: CaseStatus;
  created_at: string;
  updated_at: string;
};

export type CaseAnalysisRow = {
  id: string;
  case_id: string;
  ai_result: StoredAnalysis["aiResult"];
  validated_evidence: StoredAnalysis["validatedEvidence"];
  rejected_evidence: StoredAnalysis["rejectedEvidence"];
  evidence_completeness_score: number;
  provenance: StoredAnalysis["provenance"] | null;
  analysis_warnings: string[] | null;
  model: string;
  prompt_version: string;
  created_at: string;
};

export type EscalationResultRow = {
  id: string;
  case_id: string;
  escalation_score: number;
  recommendation: EscalationRecommendation;
  contributing_factors: EscalationEngineResult["contributingFactors"];
  recommendation_reasons: string[];
  source: "deterministic_engine";
  created_at: string;
};

export type HumanDecisionRow = {
  id: string;
  case_id: string;
  decision: HumanDecision["decision"];
  rationale: string;
  decided_at: string;
  decided_by: string;
  escalation_score_at_decision: number;
  recommendation_at_decision: EscalationRecommendation;
  source: "human_decision";
};

export type EngineeringHandoffRow = {
  id: string;
  case_id: string;
  title: string;
  summary: string;
  customer_impact: string;
  environment: string;
  reported_severity: Severity;
  affected_customer_count: number | null;
  issue_category: string;
  steps_to_reproduce: string;
  expected_behaviour: string;
  actual_behaviour: string;
  reproducibility: string;
  troubleshooting_performed: string;
  evidence: EscalationHandoff["evidence"];
  missing_evidence: string[];
  suspected_root_cause: string;
  escalation_score: number;
  escalation_recommendation: EscalationRecommendation;
  decision_rationale: string;
  created_at: string;
  source: "engineering_handoff";
};

export type CaseEventRow = {
  id: string;
  case_id: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function toIso(value: string | null | undefined): string {
  if (!value) {
    return new Date(0).toISOString();
  }
  // Postgres timestamptz may arrive without Z; normalize via Date.
  return new Date(value).toISOString();
}

function toIsoOrNull(value: string | null | undefined): string | null {
  if (value == null || value === "") {
    return null;
  }
  return new Date(value).toISOString();
}

function textOrEmpty(value: string | null | undefined): string {
  return value ?? "";
}

export function supportCaseToInsert(
  id: string,
  input: CreateCaseInput,
  status: CaseStatus,
  createdAt: string,
  updatedAt: string,
): SupportCaseRow {
  return {
    id,
    customer: input.customer,
    product: input.product,
    severity: input.severity,
    issue_title: input.issueTitle,
    issue_description: input.issueDescription,
    environment: input.environment,
    steps_to_reproduce: input.stepsToReproduce.trim()
      ? input.stepsToReproduce.trim()
      : null,
    expected_behaviour: input.expectedBehaviour.trim()
      ? input.expectedBehaviour.trim()
      : null,
    actual_behaviour: input.actualBehaviour.trim()
      ? input.actualBehaviour.trim()
      : null,
    troubleshooting_performed: input.troubleshootingPerformed,
    logs_errors: input.logsErrors,
    request_ids: input.requestIds,
    incident_timestamp: input.incidentTimestamp ?? null,
    issue_first_observed: input.issueFirstObserved?.trim()
      ? input.issueFirstObserved.trim()
      : null,
    affected_customer_count: input.affectedCustomerCount ?? null,
    status,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function supportCaseFromRow(row: SupportCaseRow): SupportCase {
  return {
    id: row.id,
    customer: row.customer,
    product: row.product,
    severity: row.severity,
    issueTitle: row.issue_title,
    issueDescription: row.issue_description,
    environment: row.environment,
    stepsToReproduce: textOrEmpty(row.steps_to_reproduce),
    expectedBehaviour: textOrEmpty(row.expected_behaviour),
    actualBehaviour: textOrEmpty(row.actual_behaviour),
    troubleshootingPerformed: row.troubleshooting_performed,
    logsErrors: row.logs_errors,
    requestIds: row.request_ids,
    incidentTimestamp: toIsoOrNull(row.incident_timestamp),
    issueFirstObserved: textOrEmpty(row.issue_first_observed) || null,
    affectedCustomerCount: row.affected_customer_count,
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function analysisToRow(
  caseId: string,
  analysis: StoredAnalysis,
): CaseAnalysisRow {
  return {
    id: analysis.id,
    case_id: caseId,
    ai_result: analysis.aiResult,
    validated_evidence: analysis.validatedEvidence,
    rejected_evidence: analysis.rejectedEvidence,
    evidence_completeness_score: analysis.evidenceCompletenessScore,
    provenance: analysis.provenance ?? null,
    analysis_warnings: analysis.analysisWarnings ?? null,
    model: analysis.model,
    prompt_version: analysis.promptVersion,
    created_at: analysis.createdAt,
  };
}

export function analysisFromRow(row: CaseAnalysisRow): StoredAnalysis {
  return {
    id: row.id,
    aiResult: row.ai_result,
    validatedEvidence: row.validated_evidence ?? [],
    rejectedEvidence: row.rejected_evidence ?? [],
    evidenceCompletenessScore: row.evidence_completeness_score,
    provenance: row.provenance ?? undefined,
    analysisWarnings: row.analysis_warnings ?? undefined,
    model: row.model,
    promptVersion: row.prompt_version,
    createdAt: toIso(row.created_at),
  };
}

export function escalationResultToRow(
  caseId: string,
  result: EscalationEngineResult,
  id?: string,
): Omit<EscalationResultRow, "created_at"> & { created_at?: string } {
  return {
    id: id ?? crypto.randomUUID(),
    case_id: caseId,
    escalation_score: result.escalationScore,
    recommendation: result.recommendation,
    contributing_factors: result.contributingFactors,
    recommendation_reasons: result.recommendationReasons,
    source: result.source,
  };
}

export function escalationResultFromRow(
  row: EscalationResultRow,
): EscalationEngineResult {
  return {
    escalationScore: row.escalation_score,
    recommendation: row.recommendation,
    contributingFactors: row.contributing_factors ?? [],
    recommendationReasons: row.recommendation_reasons ?? [],
    source: "deterministic_engine",
  };
}

export function humanDecisionToRow(decision: HumanDecision): HumanDecisionRow {
  return {
    id: decision.id,
    case_id: decision.caseId,
    decision: decision.decision,
    rationale: decision.rationale,
    decided_at: decision.decidedAt,
    decided_by: decision.decidedBy,
    escalation_score_at_decision: decision.escalationScoreAtDecision,
    recommendation_at_decision: decision.recommendationAtDecision,
    source: decision.source,
  };
}

export function humanDecisionFromRow(row: HumanDecisionRow): HumanDecision {
  return {
    id: row.id,
    caseId: row.case_id,
    decision: row.decision,
    rationale: row.rationale,
    decidedAt: toIso(row.decided_at),
    decidedBy: row.decided_by,
    escalationScoreAtDecision: row.escalation_score_at_decision,
    recommendationAtDecision: row.recommendation_at_decision,
    source: "human_decision",
  };
}

export function handoffToRow(handoff: EscalationHandoff): EngineeringHandoffRow {
  return {
    id: handoff.id,
    case_id: handoff.caseId,
    title: handoff.title,
    summary: handoff.summary,
    customer_impact: handoff.customerImpact,
    environment: handoff.environment,
    reported_severity: handoff.reportedSeverity,
    affected_customer_count: handoff.affectedCustomerCount,
    issue_category: handoff.issueCategory,
    steps_to_reproduce: handoff.stepsToReproduce,
    expected_behaviour: handoff.expectedBehaviour,
    actual_behaviour: handoff.actualBehaviour,
    reproducibility: handoff.reproducibility,
    troubleshooting_performed: handoff.troubleshootingPerformed,
    evidence: handoff.evidence,
    missing_evidence: handoff.missingEvidence,
    suspected_root_cause: handoff.suspectedRootCause,
    escalation_score: handoff.escalationScore,
    escalation_recommendation: handoff.escalationRecommendation,
    decision_rationale: handoff.decisionRationale,
    created_at: handoff.createdAt,
    source: handoff.source,
  };
}

export function handoffFromRow(row: EngineeringHandoffRow): EscalationHandoff {
  return {
    id: row.id,
    caseId: row.case_id,
    title: row.title,
    summary: row.summary,
    customerImpact: row.customer_impact,
    environment: row.environment,
    reportedSeverity: row.reported_severity,
    affectedCustomerCount: row.affected_customer_count,
    issueCategory: row.issue_category,
    stepsToReproduce: textOrEmpty(row.steps_to_reproduce),
    expectedBehaviour: textOrEmpty(row.expected_behaviour),
    actualBehaviour: textOrEmpty(row.actual_behaviour),
    reproducibility: row.reproducibility,
    troubleshootingPerformed: row.troubleshooting_performed,
    evidence: row.evidence ?? [],
    missingEvidence: row.missing_evidence ?? [],
    suspectedRootCause: row.suspected_root_cause,
    escalationScore: row.escalation_score,
    escalationRecommendation: row.escalation_recommendation,
    decisionRationale: row.decision_rationale,
    createdAt: toIso(row.created_at),
    source: "engineering_handoff",
  };
}

export function caseEventToRow(event: CaseEvent): CaseEventRow {
  return {
    id: event.id,
    case_id: event.caseId,
    event_type: event.eventType,
    metadata: event.metadata ?? null,
    created_at: event.createdAt,
  };
}

export function caseEventFromRow(row: CaseEventRow): CaseEvent {
  return {
    id: row.id,
    caseId: row.case_id,
    eventType: row.event_type as CaseEventType,
    metadata: row.metadata ?? undefined,
    createdAt: toIso(row.created_at),
  };
}

export function supportCaseSummaryFromParts(
  caseRow: SupportCaseRow,
  escalation?: Pick<
    EscalationResultRow,
    "recommendation" | "escalation_score"
  > | null,
): SupportCaseSummary {
  const supportCase = supportCaseFromRow(caseRow);
  return {
    id: supportCase.id,
    customer: supportCase.customer,
    product: supportCase.product,
    severity: supportCase.severity,
    issueTitle: supportCase.issueTitle,
    environment: supportCase.environment,
    status: supportCase.status,
    createdAt: supportCase.createdAt,
    updatedAt: supportCase.updatedAt,
    escalationRecommendation: escalation?.recommendation,
    escalationScore: escalation?.escalation_score,
  };
}

export function assembleCaseRecord(parts: {
  caseRow: SupportCaseRow;
  analysis?: CaseAnalysisRow | null;
  escalation?: EscalationResultRow | null;
  decision?: HumanDecisionRow | null;
  handoff?: EngineeringHandoffRow | null;
  events?: CaseEventRow[];
}): CaseRecord {
  const supportCase = supportCaseFromRow(parts.caseRow);
  return {
    ...supportCase,
    analysis: parts.analysis ? analysisFromRow(parts.analysis) : undefined,
    escalationResult: parts.escalation
      ? escalationResultFromRow(parts.escalation)
      : undefined,
    decision: parts.decision ? humanDecisionFromRow(parts.decision) : undefined,
    handoff: parts.handoff ? handoffFromRow(parts.handoff) : undefined,
    events: (parts.events ?? []).map(caseEventFromRow),
  };
}

/** JSON payload for persist_decision_outcome RPC (camelCase for SQL jsonb accessors). */
export function decisionToRpcPayload(decision: HumanDecision): Record<string, unknown> {
  return {
    id: decision.id,
    decision: decision.decision,
    rationale: decision.rationale,
    decidedAt: decision.decidedAt,
    decidedBy: decision.decidedBy,
    escalationScoreAtDecision: decision.escalationScoreAtDecision,
    recommendationAtDecision: decision.recommendationAtDecision,
    source: decision.source,
  };
}

export function handoffToRpcPayload(
  handoff: EscalationHandoff,
): Record<string, unknown> {
  return {
    id: handoff.id,
    title: handoff.title,
    summary: handoff.summary,
    customerImpact: handoff.customerImpact,
    environment: handoff.environment,
    reportedSeverity: handoff.reportedSeverity,
    affectedCustomerCount: handoff.affectedCustomerCount,
    issueCategory: handoff.issueCategory,
    stepsToReproduce: handoff.stepsToReproduce,
    expectedBehaviour: handoff.expectedBehaviour,
    actualBehaviour: handoff.actualBehaviour,
    reproducibility: handoff.reproducibility,
    troubleshootingPerformed: handoff.troubleshootingPerformed,
    evidence: handoff.evidence,
    missingEvidence: handoff.missingEvidence,
    suspectedRootCause: handoff.suspectedRootCause,
    escalationScore: handoff.escalationScore,
    escalationRecommendation: handoff.escalationRecommendation,
    decisionRationale: handoff.decisionRationale,
    createdAt: handoff.createdAt,
    source: handoff.source,
  };
}

export function caseEventToRpcPayload(event: CaseEvent): Record<string, unknown> {
  return {
    id: event.id,
    eventType: event.eventType,
    metadata: event.metadata ?? null,
    createdAt: event.createdAt,
  };
}

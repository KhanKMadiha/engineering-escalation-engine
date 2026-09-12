/**
 * Stable API response DTOs derived from domain objects.
 * Do not leak repository/Supabase row shapes.
 */

import type {
  CaseEvent,
  CaseRecord,
  EscalationEngineResult,
  EscalationHandoff,
  HumanDecision,
  StoredAnalysis,
  SupportCase,
  SupportCaseSummary,
} from "@/types";

const SENSITIVE_METADATA_KEYS = new Set([
  "prompt",
  "rawResponse",
  "raw_response",
  "authorization",
  "apiKey",
  "api_key",
  "serviceRoleKey",
  "service_role_key",
]);

export function toCaseResponse(caseRecord: SupportCase) {
  return {
    id: caseRecord.id,
    customer: caseRecord.customer,
    product: caseRecord.product,
    severity: caseRecord.severity,
    issueTitle: caseRecord.issueTitle,
    issueDescription: caseRecord.issueDescription,
    environment: caseRecord.environment,
    stepsToReproduce: caseRecord.stepsToReproduce,
    expectedBehaviour: caseRecord.expectedBehaviour,
    actualBehaviour: caseRecord.actualBehaviour,
    troubleshootingPerformed: caseRecord.troubleshootingPerformed,
    logsErrors: caseRecord.logsErrors,
    requestIds: caseRecord.requestIds,
    incidentTimestamp: caseRecord.incidentTimestamp,
    issueFirstObserved: caseRecord.issueFirstObserved,
    affectedCustomerCount: caseRecord.affectedCustomerCount,
    status: caseRecord.status,
    createdAt: caseRecord.createdAt,
    updatedAt: caseRecord.updatedAt,
  };
}

export function toCaseSummaryResponse(summary: SupportCaseSummary) {
  return {
    id: summary.id,
    customer: summary.customer,
    product: summary.product,
    severity: summary.severity,
    issueTitle: summary.issueTitle,
    environment: summary.environment,
    status: summary.status,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    escalationRecommendation: summary.escalationRecommendation ?? null,
    escalationScore: summary.escalationScore ?? null,
  };
}

function toAnalysisResponse(analysis: StoredAnalysis) {
  return {
    id: analysis.id,
    model: analysis.model,
    promptVersion: analysis.promptVersion,
    createdAt: analysis.createdAt,
    evidenceCompletenessScore: analysis.evidenceCompletenessScore,
    analysisWarnings: analysis.analysisWarnings ?? [],
    provenance: analysis.provenance ?? {},
    validatedEvidence: analysis.validatedEvidence.map((item) => ({
      ...item,
      source: "extracted_evidence" as const,
    })),
    rejectedEvidence: analysis.rejectedEvidence,
    aiResult: {
      assessedSeverity: analysis.aiResult.assessedSeverity,
      issueCategory: analysis.aiResult.issueCategory,
      reproducibility: analysis.aiResult.reproducibility,
      suspectedProductDefect: analysis.aiResult.suspectedProductDefect,
      reasoning: analysis.aiResult.reasoning,
      missingEvidence: analysis.aiResult.missingEvidence,
      recommendedNextSteps: analysis.aiResult.recommendedNextSteps,
      suspectedRootCause: analysis.aiResult.suspectedRootCause,
      aiEscalationAssessment: analysis.aiResult.aiEscalationAssessment,
      // evidenceIdentified kept for transparency; validatedEvidence is authoritative
      evidenceIdentified: analysis.aiResult.evidenceIdentified,
    },
  };
}

function toEscalationResponse(result: EscalationEngineResult) {
  return {
    escalationScore: result.escalationScore,
    recommendation: result.recommendation,
    contributingFactors: result.contributingFactors,
    recommendationReasons: result.recommendationReasons,
    source: result.source,
  };
}

function toDecisionResponse(decision: HumanDecision) {
  return {
    id: decision.id,
    caseId: decision.caseId,
    decision: decision.decision,
    rationale: decision.rationale,
    decidedAt: decision.decidedAt,
    decidedBy: decision.decidedBy,
    escalationScoreAtDecision: decision.escalationScoreAtDecision,
    recommendationAtDecision: decision.recommendationAtDecision,
    source: decision.source,
  };
}

export function toHandoffResponse(handoff: EscalationHandoff) {
  return {
    id: handoff.id,
    caseId: handoff.caseId,
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
    evidence: handoff.evidence.map((item) => ({
      description: item.description,
      sourceField: item.sourceField,
      quotedExcerpt: item.quotedExcerpt,
      source: item.source,
    })),
    missingEvidence: handoff.missingEvidence,
    suspectedRootCause: handoff.suspectedRootCause,
    escalationScore: handoff.escalationScore,
    escalationRecommendation: handoff.escalationRecommendation,
    decisionRationale: handoff.decisionRationale,
    createdAt: handoff.createdAt,
    source: handoff.source,
    provenanceNotes: {
      customerProvided: [
        "customerImpact",
        "environment",
        "reportedSeverity",
        "stepsToReproduce",
        "expectedBehaviour",
        "actualBehaviour",
        "troubleshootingPerformed",
      ],
      validatedEvidence: "evidence[].source === extracted_evidence",
      deterministicEngine: [
        "escalationScore",
        "escalationRecommendation",
      ],
      humanDecision: ["decisionRationale"],
      aiInference: ["issueCategory", "reproducibility", "suspectedRootCause"],
    },
  };
}

function sanitizeEventMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_METADATA_KEYS.has(key)) {
      continue;
    }
    if (typeof value === "string" && value.length > 2000) {
      out[key] = `${value.slice(0, 2000)}…`;
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function toEventResponse(event: CaseEvent) {
  return {
    id: event.id,
    caseId: event.caseId,
    eventType: event.eventType,
    createdAt: event.createdAt,
    metadata: sanitizeEventMetadata(event.metadata) ?? null,
  };
}

export function toCaseDetailResponse(record: CaseRecord) {
  return {
    ...toCaseResponse(record),
    analysis: record.analysis ? toAnalysisResponse(record.analysis) : null,
    escalationResult: record.escalationResult
      ? toEscalationResponse(record.escalationResult)
      : null,
    decision: record.decision ? toDecisionResponse(record.decision) : null,
    handoff: record.handoff ? toHandoffResponse(record.handoff) : null,
    eventCount: record.events.length,
  };
}

export function toDecisionActionResponse(input: {
  record: CaseRecord;
  decision: HumanDecision;
  handoff?: EscalationHandoff;
}) {
  return {
    caseId: input.record.id,
    status: input.record.status,
    decision: toDecisionResponse(input.decision),
    handoff: input.handoff ? toHandoffResponse(input.handoff) : null,
  };
}

export function toAnalysisActionResponse(input: {
  caseId: string;
  record: CaseRecord;
  analysisId: string;
  escalationResult: EscalationEngineResult;
}) {
  return {
    caseId: input.caseId,
    status: input.record.status,
    analysisId: input.analysisId,
    escalationResult: toEscalationResponse(input.escalationResult),
  };
}

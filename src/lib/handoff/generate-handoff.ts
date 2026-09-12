import type {
  CaseRecord,
  EscalationEngineResult,
  EscalationHandoff,
  EscalationHandoffEvidenceItem,
  HumanDecision,
  StoredAnalysis,
  SupportCase,
} from "@/types";

export const HANDOFF_NOT_PROVIDED = "Not provided";
export const HANDOFF_NOT_ESTABLISHED = "Not established";
export const HANDOFF_EVIDENCE_NOT_AVAILABLE = "Evidence not available";

function textOrNotProvided(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === "") {
    return HANDOFF_NOT_PROVIDED;
  }
  return value.trim();
}

function buildCustomerImpact(caseRecord: SupportCase): string {
  const parts: string[] = [];
  parts.push(`Customer: ${caseRecord.customer}`);
  parts.push(`Product: ${caseRecord.product}`);
  if (caseRecord.affectedCustomerCount !== null) {
    parts.push(`Affected customers: ${caseRecord.affectedCustomerCount}`);
  } else {
    parts.push(`Affected customers: ${HANDOFF_NOT_PROVIDED}`);
  }
  return parts.join("\n");
}

function buildSummary(
  caseRecord: SupportCase,
  analysis: StoredAnalysis | undefined,
  engine: EscalationEngineResult,
  decision: HumanDecision,
): string {
  const category = analysis?.aiResult.issueCategory ?? HANDOFF_NOT_ESTABLISHED;
  return [
    `${caseRecord.issueTitle} (${caseRecord.product} / ${caseRecord.customer}).`,
    `Customer-reported severity: ${caseRecord.severity}; environment: ${caseRecord.environment}.`,
    `Issue category (AI inference): ${category}.`,
    `Escalation Engine score ${engine.escalationScore}/100 → ${engine.recommendation}.`,
    `Human decision: ${decision.decision} by ${decision.decidedBy}.`,
  ].join(" ");
}

export type GenerateHandoffInput = {
  caseRecord: SupportCase;
  analysis?: StoredAnalysis;
  escalationResult: EscalationEngineResult;
  decision: HumanDecision;
  id?: string;
  createdAt?: string;
};

/**
 * Deterministic engineering handoff generator.
 * Does not call OpenAI. Never invents technical evidence.
 */
export function generateEngineeringHandoff(
  input: GenerateHandoffInput,
): EscalationHandoff {
  const { caseRecord, analysis, escalationResult, decision } = input;
  const evidence: EscalationHandoffEvidenceItem[] =
    analysis?.validatedEvidence.map((item) => ({
      description: item.description,
      sourceField: item.sourceField,
      quotedExcerpt: item.quotedExcerpt,
      source: "extracted_evidence" as const,
    })) ?? [];

  const missingEvidence =
    analysis && analysis.aiResult.missingEvidence.length > 0
      ? [...analysis.aiResult.missingEvidence]
      : [HANDOFF_EVIDENCE_NOT_AVAILABLE];

  const suspectedRootCause =
    analysis?.aiResult.suspectedRootCause &&
    analysis.aiResult.suspectedRootCause.trim() !== ""
      ? analysis.aiResult.suspectedRootCause
      : HANDOFF_NOT_ESTABLISHED;

  return {
    id: input.id ?? crypto.randomUUID(),
    caseId: caseRecord.id,
    title: caseRecord.issueTitle,
    summary: buildSummary(caseRecord, analysis, escalationResult, decision),
    customerImpact: buildCustomerImpact(caseRecord),
    environment: caseRecord.environment,
    reportedSeverity: caseRecord.severity,
    affectedCustomerCount: caseRecord.affectedCustomerCount,
    issueCategory: analysis?.aiResult.issueCategory ?? HANDOFF_NOT_ESTABLISHED,
    stepsToReproduce: textOrNotProvided(caseRecord.stepsToReproduce),
    expectedBehaviour: textOrNotProvided(caseRecord.expectedBehaviour),
    actualBehaviour: textOrNotProvided(caseRecord.actualBehaviour),
    reproducibility:
      analysis?.aiResult.reproducibility ?? HANDOFF_NOT_ESTABLISHED,
    troubleshootingPerformed: textOrNotProvided(
      caseRecord.troubleshootingPerformed,
    ),
    evidence,
    missingEvidence,
    suspectedRootCause,
    escalationScore: escalationResult.escalationScore,
    escalationRecommendation: escalationResult.recommendation,
    decisionRationale: decision.rationale,
    createdAt: input.createdAt ?? new Date().toISOString(),
    source: "engineering_handoff",
  };
}

/** Convenience wrapper when a full CaseRecord is available. */
export function generateEngineeringHandoffFromRecord(
  record: CaseRecord,
  decision: HumanDecision,
  options?: { id?: string; createdAt?: string },
): EscalationHandoff {
  if (!record.escalationResult) {
    throw new Error("Cannot generate handoff without an escalation result");
  }
  return generateEngineeringHandoff({
    caseRecord: record,
    analysis: record.analysis,
    escalationResult: record.escalationResult,
    decision,
    id: options?.id,
    createdAt: options?.createdAt,
  });
}

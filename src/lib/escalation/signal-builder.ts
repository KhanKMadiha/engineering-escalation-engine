import { normalizeWhitespace } from "@/lib/analysis/evidence-validator";
import type { CaseAnalysisResult } from "@/lib/analysis/analysis-schema";
import type { EvidenceValidationResult } from "@/lib/analysis/evidence-validator";
import {
  parseEscalationSignals,
  type EscalationSignals,
} from "@/lib/escalation/escalation-schema";
import type { SupportCase } from "@/types";

export type SignalBuilderAnalysisInput = {
  /** Analysis result after evidence validation (validated excerpts only). */
  result: CaseAnalysisResult;
  evidenceValidation: EvidenceValidationResult;
};

function hasNonEmptyText(value: string | null | undefined): boolean {
  return normalizeWhitespace(value ?? "").length > 0;
}

/**
 * Builds EscalationSignals from customer case + validated Phase 3 analysis.
 * Does not invent missing signals. Unvalidated evidence cannot influence completeness.
 */
export function buildEscalationSignals(
  caseRecord: SupportCase,
  analysis: SignalBuilderAnalysisInput,
): EscalationSignals {
  const validatedEvidence = analysis.evidenceValidation.validatedEvidence;
  const completenessScore = analysis.evidenceValidation.evidenceCompletenessScore;

  const issueCategory = analysis.result.issueCategory;
  const configurationOrUserErrorIndicator =
    issueCategory === "configuration" || issueCategory === "user_error";

  const raw: EscalationSignals = {
    reportedSeverity: caseRecord.severity,
    environment: caseRecord.environment,
    affectedCustomerCount: caseRecord.affectedCustomerCount,
    troubleshootingPerformed: hasNonEmptyText(
      caseRecord.troubleshootingPerformed,
    ),
    hasLogsOrErrors: hasNonEmptyText(caseRecord.logsErrors),
    hasRequestIds: hasNonEmptyText(caseRecord.requestIds),
    hasIncidentTimestamp: caseRecord.incidentTimestamp !== null,

    aiAssessedSeverity: analysis.result.assessedSeverity,
    issueCategory,
    reproducibility: analysis.result.reproducibility,
    suspectedProductDefect: analysis.result.suspectedProductDefect,
    evidenceCompletenessScore: completenessScore,
    validatedEvidenceCount: validatedEvidence.length,
    missingEvidenceCount: analysis.result.missingEvidence.length,
    configurationOrUserErrorIndicator,
  };

  const parsed = parseEscalationSignals(raw);
  if (!parsed.success) {
    throw new Error("Failed to build valid EscalationSignals from case analysis");
  }
  return parsed.data;
}

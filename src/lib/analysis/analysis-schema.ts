import { z } from "zod";

export const ASSESSED_SEVERITY_VALUES = [
  "critical",
  "high",
  "medium",
  "low",
] as const;

export const ISSUE_CATEGORY_VALUES = [
  "bug",
  "configuration",
  "performance",
  "integration",
  "data_issue",
  "user_error",
  "unknown",
] as const;

export const REPRODUCIBILITY_VALUES = [
  "confirmed",
  "intermittent",
  "not_reproduced",
  "unknown",
] as const;

export const AI_ESCALATION_ASSESSMENT_VALUES = [
  "likely_escalate",
  "likely_continue",
  "insufficient_data",
] as const;

/** Customer case fields the AI may cite as evidence sources. */
export const EVIDENCE_SOURCE_FIELD_VALUES = [
  "issueTitle",
  "issueDescription",
  "environment",
  "stepsToReproduce",
  "expectedBehaviour",
  "actualBehaviour",
  "troubleshootingPerformed",
  "logsErrors",
  "requestIds",
] as const;

export type EvidenceSourceField = (typeof EVIDENCE_SOURCE_FIELD_VALUES)[number];

export const evidenceIdentifiedItemSchema = z.object({
  description: z.string().min(1).max(1000),
  sourceField: z.enum(EVIDENCE_SOURCE_FIELD_VALUES),
  quotedExcerpt: z.string().min(1).max(5000),
});

/**
 * Structured AI analysis output.
 * Advisory only — does not include an authoritative escalation decision.
 */
export const caseAnalysisResultSchema = z.object({
  assessedSeverity: z.enum(ASSESSED_SEVERITY_VALUES),
  issueCategory: z.enum(ISSUE_CATEGORY_VALUES),
  reproducibility: z.enum(REPRODUCIBILITY_VALUES),
  suspectedProductDefect: z.boolean(),
  reasoning: z.string().min(1).max(4000),
  evidenceIdentified: z.array(evidenceIdentifiedItemSchema).max(30),
  missingEvidence: z.array(z.string().min(1).max(500)).max(30),
  recommendedNextSteps: z.array(z.string().min(1).max(500)).max(30),
  suspectedRootCause: z.union([z.string().min(1).max(2000), z.null()]),
  /** Advisory only — not the authoritative escalation recommendation. */
  aiEscalationAssessment: z.union([
    z.enum(AI_ESCALATION_ASSESSMENT_VALUES),
    z.null(),
  ]),
});

export type EvidenceIdentifiedItem = z.infer<typeof evidenceIdentifiedItemSchema>;
export type CaseAnalysisResult = z.infer<typeof caseAnalysisResultSchema>;

export type AnalysisSchemaParseResult =
  | { success: true; data: CaseAnalysisResult }
  | { success: false; error: z.ZodError };

export function parseCaseAnalysisResult(
  input: unknown,
): AnalysisSchemaParseResult {
  const result = caseAnalysisResultSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

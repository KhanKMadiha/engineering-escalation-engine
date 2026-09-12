import { z } from "zod";
import type { EscalationRecommendation } from "@/types";

export const ESCALATION_SEVERITY_VALUES = [
  "critical",
  "high",
  "medium",
  "low",
] as const;

export const ESCALATION_ENVIRONMENT_VALUES = [
  "production",
  "staging",
  "development",
  "unknown",
] as const;

export const ESCALATION_ISSUE_CATEGORY_VALUES = [
  "bug",
  "configuration",
  "performance",
  "integration",
  "data_issue",
  "user_error",
  "unknown",
] as const;

export const ESCALATION_REPRODUCIBILITY_VALUES = [
  "confirmed",
  "intermittent",
  "not_reproduced",
  "unknown",
] as const;

export const ESCALATION_RECOMMENDATION_VALUES = [
  "escalate",
  "continue_investigation",
  "insufficient_evidence",
] as const;

/**
 * Normalized inputs for the deterministic Escalation Engine.
 * Invalid values must not enter the engine.
 */
export const escalationSignalsSchema = z.object({
  reportedSeverity: z.enum(ESCALATION_SEVERITY_VALUES),
  environment: z.enum(ESCALATION_ENVIRONMENT_VALUES),
  affectedCustomerCount: z.union([z.number().int().min(0), z.null()]),
  troubleshootingPerformed: z.boolean(),
  hasLogsOrErrors: z.boolean(),
  hasRequestIds: z.boolean(),
  hasIncidentTimestamp: z.boolean(),

  aiAssessedSeverity: z.enum(ESCALATION_SEVERITY_VALUES),
  issueCategory: z.enum(ESCALATION_ISSUE_CATEGORY_VALUES),
  reproducibility: z.enum(ESCALATION_REPRODUCIBILITY_VALUES),
  suspectedProductDefect: z.boolean(),
  evidenceCompletenessScore: z.number().min(0).max(1),
  validatedEvidenceCount: z.number().int().min(0),
  missingEvidenceCount: z.number().int().min(0),
  configurationOrUserErrorIndicator: z.boolean(),
});

export type EscalationSignals = z.infer<typeof escalationSignalsSchema>;

export type EscalationFactorDirection = "increases" | "decreases" | "neutral";

export type EscalationContributingFactor = {
  signal: string;
  weight: number;
  direction: EscalationFactorDirection;
  reason: string;
};

export type EscalationEngineResult = {
  escalationScore: number;
  recommendation: EscalationRecommendation;
  contributingFactors: EscalationContributingFactor[];
  recommendationReasons: string[];
  source: "deterministic_engine";
};

export function parseEscalationSignals(
  input: unknown,
):
  | { success: true; data: EscalationSignals }
  | { success: false; error: z.ZodError } {
  const result = escalationSignalsSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

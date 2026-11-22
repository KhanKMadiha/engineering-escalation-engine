import type {
  EscalationEngineResult,
  HumanDecision,
  StoredAnalysis,
} from "@/types";

/**
 * Presentation/persistence helpers for assessment versioning (Increment 2+).
 * Does not change scoring rules.
 */

export function ensureAnalysisVersioning(
  analysis: StoredAnalysis,
  fallbackVersion = 1,
): StoredAnalysis {
  return {
    ...analysis,
    assessmentVersion: analysis.assessmentVersion ?? fallbackVersion,
    isCurrent: analysis.isCurrent ?? true,
  };
}

export function ensureEscalationVersioning(
  result: EscalationEngineResult,
  assessmentVersion: number,
  isCurrent = true,
): EscalationEngineResult {
  return {
    ...result,
    assessmentVersion,
    isCurrent,
  };
}

export function ensureDecisionVersioning(
  decision: HumanDecision,
  fallbackVersion = 1,
): HumanDecision {
  return {
    ...decision,
    assessmentVersion: decision.assessmentVersion ?? fallbackVersion,
    isException: decision.isException ?? false,
    exceptionReason: decision.exceptionReason ?? null,
  };
}

export function nextAssessmentVersion(
  currentVersion: number | null | undefined,
): number {
  if (currentVersion == null || currentVersion < 1) {
    return 1;
  }
  return currentVersion + 1;
}

/**
 * Deterministic scoring constants for the Escalation Engine.
 * AI cannot change these thresholds or weights.
 */

/** Positive / negative factor weights */
export const ESCALATION_WEIGHTS = {
  productionEnvironment: 25,
  nonProductionEnvironment: -10,

  reportedSeverityCritical: 20,
  reportedSeverityHigh: 15,
  reportedSeverityMedium: 5,
  reportedSeverityLow: 0,

  /** Secondary contribution — must not override reported severity. */
  aiSeverityCritical: 5,
  aiSeverityHigh: 3,
  aiSeverityMedium: 0,
  aiSeverityLow: 0,

  suspectedProductDefect: 20,
  confirmedReproducibility: 15,
  intermittentReproducibility: 5,
  evidenceCompletenessHigh: 10,
  troubleshootingCompleted: 10,
  multipleAffectedCustomers: 10,

  configurationOrUserError: -20,
  missingLogsAndRequestIds: -15,
} as const;

/** Completeness at or above this value earns the high-completeness bonus. */
export const EVIDENCE_COMPLETENESS_THRESHOLD = 0.7;

/** Recommendation score thresholds (inclusive lower bounds where noted). */
export const ESCALATION_THRESHOLDS = {
  /** score >= escalateMin → escalate */
  escalateMin: 70,
  /** score >= continueMin && score < escalateMin → continue_investigation */
  continueMin: 40,
  /** score < continueMin → insufficient_evidence */
} as const;

export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

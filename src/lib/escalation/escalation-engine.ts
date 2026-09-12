import {
  ESCALATION_THRESHOLDS,
  ESCALATION_WEIGHTS,
  EVIDENCE_COMPLETENESS_THRESHOLD,
  SCORE_MAX,
  SCORE_MIN,
} from "@/lib/escalation/escalation-rules";
import {
  parseEscalationSignals,
  type EscalationContributingFactor,
  type EscalationEngineResult,
  type EscalationSignals,
} from "@/lib/escalation/escalation-schema";
import type { EscalationRecommendation } from "@/types";

export class EscalationEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EscalationEngineError";
  }
}

export function clampScore(score: number): number {
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
}

export function recommendationFromScore(
  score: number,
): EscalationRecommendation {
  if (score >= ESCALATION_THRESHOLDS.escalateMin) {
    return "escalate";
  }
  if (score >= ESCALATION_THRESHOLDS.continueMin) {
    return "continue_investigation";
  }
  return "insufficient_evidence";
}

function collectFactors(
  signals: EscalationSignals,
): EscalationContributingFactor[] {
  const factors: EscalationContributingFactor[] = [];

  if (signals.environment === "production") {
    factors.push({
      signal: "production_environment",
      weight: ESCALATION_WEIGHTS.productionEnvironment,
      direction: "increases",
      reason: "The reported issue is affecting a production environment.",
    });
  } else if (
    signals.environment === "staging" ||
    signals.environment === "development"
  ) {
    factors.push({
      signal: "non_production_environment",
      weight: ESCALATION_WEIGHTS.nonProductionEnvironment,
      direction: "decreases",
      reason: `The reported environment is ${signals.environment}, which lowers production impact.`,
    });
  } else {
    factors.push({
      signal: "unknown_environment",
      weight: 0,
      direction: "neutral",
      reason:
        "Environment is unknown; no production-impact bonus or penalty applied.",
    });
  }

  const reportedWeight =
    signals.reportedSeverity === "critical"
      ? ESCALATION_WEIGHTS.reportedSeverityCritical
      : signals.reportedSeverity === "high"
        ? ESCALATION_WEIGHTS.reportedSeverityHigh
        : signals.reportedSeverity === "medium"
          ? ESCALATION_WEIGHTS.reportedSeverityMedium
          : ESCALATION_WEIGHTS.reportedSeverityLow;

  factors.push({
    signal: "reported_severity",
    weight: reportedWeight,
    direction: reportedWeight > 0 ? "increases" : "neutral",
    reason: `Customer-reported severity is ${signals.reportedSeverity}.`,
  });

  const aiSeverityWeight =
    signals.aiAssessedSeverity === "critical"
      ? ESCALATION_WEIGHTS.aiSeverityCritical
      : signals.aiAssessedSeverity === "high"
        ? ESCALATION_WEIGHTS.aiSeverityHigh
        : signals.aiAssessedSeverity === "medium"
          ? ESCALATION_WEIGHTS.aiSeverityMedium
          : ESCALATION_WEIGHTS.aiSeverityLow;

  factors.push({
    signal: "ai_assessed_severity",
    weight: aiSeverityWeight,
    direction: aiSeverityWeight > 0 ? "increases" : "neutral",
    reason: `AI-assessed severity is ${signals.aiAssessedSeverity} (secondary signal; does not override customer-reported severity).`,
  });

  if (signals.suspectedProductDefect) {
    factors.push({
      signal: "suspected_product_defect",
      weight: ESCALATION_WEIGHTS.suspectedProductDefect,
      direction: "increases",
      reason:
        "Validated analysis indicates a suspected product defect (contributes to score; does not alone force escalation).",
    });
  }

  if (signals.reproducibility === "confirmed") {
    factors.push({
      signal: "confirmed_reproducibility",
      weight: ESCALATION_WEIGHTS.confirmedReproducibility,
      direction: "increases",
      reason: "Issue reproducibility is confirmed, improving engineering actionability.",
    });
  } else if (signals.reproducibility === "intermittent") {
    factors.push({
      signal: "intermittent_reproducibility",
      weight: ESCALATION_WEIGHTS.intermittentReproducibility,
      direction: "increases",
      reason: "Issue is intermittent; partial credit for partial reproducibility.",
    });
  } else {
    factors.push({
      signal: "reproducibility",
      weight: 0,
      direction: "neutral",
      reason: `Reproducibility is ${signals.reproducibility}; no confirmed-reproduction bonus applied.`,
    });
  }

  if (signals.evidenceCompletenessScore >= EVIDENCE_COMPLETENESS_THRESHOLD) {
    factors.push({
      signal: "evidence_completeness",
      weight: ESCALATION_WEIGHTS.evidenceCompletenessHigh,
      direction: "increases",
      reason: `Validated evidence completeness is ${signals.evidenceCompletenessScore} (≥ ${EVIDENCE_COMPLETENESS_THRESHOLD}).`,
    });
  } else {
    factors.push({
      signal: "evidence_completeness",
      weight: 0,
      direction: "neutral",
      reason: `Validated evidence completeness is ${signals.evidenceCompletenessScore} (below ${EVIDENCE_COMPLETENESS_THRESHOLD}); no completeness bonus.`,
    });
  }

  if (signals.troubleshootingPerformed) {
    factors.push({
      signal: "troubleshooting_completed",
      weight: ESCALATION_WEIGHTS.troubleshootingCompleted,
      direction: "increases",
      reason: "Support documented troubleshooting steps before escalation review.",
    });
  }

  if (
    signals.affectedCustomerCount !== null &&
    signals.affectedCustomerCount > 1
  ) {
    factors.push({
      signal: "multiple_affected_customers",
      weight: ESCALATION_WEIGHTS.multipleAffectedCustomers,
      direction: "increases",
      reason: `Affected customer count is ${signals.affectedCustomerCount}, indicating broader blast radius.`,
    });
  }

  if (signals.configurationOrUserErrorIndicator) {
    factors.push({
      signal: "configuration_or_user_error",
      weight: ESCALATION_WEIGHTS.configurationOrUserError,
      direction: "decreases",
      reason: `Issue category is ${signals.issueCategory}, which often indicates non-engineering ownership.`,
    });
  }

  if (!signals.hasLogsOrErrors && !signals.hasRequestIds) {
    factors.push({
      signal: "missing_logs_and_request_ids",
      weight: ESCALATION_WEIGHTS.missingLogsAndRequestIds,
      direction: "decreases",
      reason:
        "Both logs/errors and request IDs are missing, reducing escalation readiness.",
    });
  }

  return factors;
}

function buildRecommendationReasons(
  recommendation: EscalationRecommendation,
  score: number,
  factors: EscalationContributingFactor[],
): string[] {
  const positives = factors
    .filter((f) => f.direction === "increases" && f.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  const negatives = factors
    .filter((f) => f.direction === "decreases" && f.weight < 0)
    .sort((a, b) => a.weight - b.weight);

  const reasons: string[] = [
    `Deterministic score is ${score}/100 → ${recommendation.replaceAll("_", " ")}.`,
  ];

  for (const factor of positives.slice(0, 3)) {
    reasons.push(factor.reason);
  }
  for (const factor of negatives.slice(0, 2)) {
    reasons.push(factor.reason);
  }

  if (recommendation === "insufficient_evidence") {
    reasons.push(
      "Missing or weak signals keep the recommendation below the investigation threshold.",
    );
  } else if (recommendation === "continue_investigation") {
    reasons.push(
      "Signals support further investigation before engineering escalation.",
    );
  } else {
    reasons.push(
      "Combined signals meet the escalation threshold; human approval is still required.",
    );
  }

  return reasons;
}

/**
 * Pure deterministic Escalation Engine.
 * No OpenAI, React, database, or repository dependencies.
 */
export function evaluateEscalation(
  input: EscalationSignals | unknown,
): EscalationEngineResult {
  const parsed = parseEscalationSignals(input);
  if (!parsed.success) {
    throw new EscalationEngineError(
      "Invalid EscalationSignals supplied to the Escalation Engine",
    );
  }

  const signals = parsed.data;
  const contributingFactors = collectFactors(signals);
  const rawScore = contributingFactors.reduce(
    (sum, factor) => sum + factor.weight,
    0,
  );
  const escalationScore = clampScore(rawScore);
  const recommendation = recommendationFromScore(escalationScore);

  return {
    escalationScore,
    recommendation,
    contributingFactors,
    recommendationReasons: buildRecommendationReasons(
      recommendation,
      escalationScore,
      contributingFactors,
    ),
    source: "deterministic_engine",
  };
}

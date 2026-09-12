/** Humanize engine signal ids for checklist display — presentation only. */
const FRIENDLY_SIGNAL_LABELS: Record<string, string> = {
  production_environment: "Production impact",
  non_production_environment: "Non-production environment",
  unknown_environment: "Unknown environment",
  reported_severity: "Customer-reported severity",
  ai_assessed_severity: "AI-assessed severity",
  suspected_product_defect: "Suspected product defect",
  confirmed_reproducibility: "Confirmed reproduction",
  intermittent_reproducibility: "Intermittent reproduction",
  evidence_completeness_high: "Strong evidence completeness",
  evidence_completeness: "Evidence completeness",
  troubleshooting_completed: "Troubleshooting documented",
  reproducibility: "Reproducibility",
  multiple_affected_customers: "Multiple affected customers",
  configuration_or_user_error: "Configuration or user error",
  missing_logs_and_request_ids: "Missing logs or request IDs",
};

export function formatSignalLabel(signal: string): string {
  if (FRIENDLY_SIGNAL_LABELS[signal]) {
    return FRIENDLY_SIGNAL_LABELS[signal];
  }
  const cleaned = signal.replaceAll("_", " ").trim();
  if (!cleaned) {
    return signal;
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Compact case key for issue header — derived from id, not a domain field. */
export function formatCaseKey(caseId: string): string {
  const compact = caseId.replaceAll("-", "").slice(0, 8).toUpperCase();
  return compact || caseId;
}

/**
 * Short troubleshooting bullets from existing customer text (deterministic).
 * Presentation only — does not invent content.
 */
export function troubleshootingSummaryLines(
  troubleshootingPerformed: string,
  maxItems = 4,
): string[] {
  return troubleshootingPerformed
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*•]\s*/, "").replace(/^\d+\.\s*/, ""))
    .filter(Boolean)
    .slice(0, maxItems);
}

/** Deterministic truncation for overview summaries — not AI summarization. */
export function shortenText(value: string, maxLength = 280): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

/** Qualifying factors for overview/checklist — existing engine output only. */
export function qualifyingFactors<
  T extends { direction: string; weight: number },
>(factors: T[]): T[] {
  const increases = factors.filter(
    (factor) => factor.direction === "increases" && factor.weight > 0,
  );
  if (increases.length > 0) {
    return increases;
  }
  return factors.filter((factor) => factor.weight !== 0);
}

/** Human-readable recommendation label for dashboard/list display. */
export function formatRecommendationLabel(recommendation: string): string {
  const cleaned = recommendation.replaceAll("_", " ").trim();
  if (!cleaned) {
    return recommendation;
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Formats stored decidedBy identities for UI display.
 * Example: support_engineer → Support Engineer.
 * Presentation only — does not alter stored values.
 */
export function formatDecidedByLabel(decidedBy: string): string {
  const trimmed = decidedBy.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed
    .replaceAll("_", " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Demo-facing reviewer label for handoff context. Maps the placeholder identity
 * `support_engineer` to a role-neutral label. Presentation only.
 */
export function formatReviewerDisplayLabel(decidedBy: string): string {
  const trimmed = decidedBy.trim();
  if (!trimmed) {
    return trimmed;
  }
  const normalized = trimmed.toLowerCase().replaceAll(/\s+/g, "_");
  if (normalized === "support_engineer") {
    return "Authorised reviewer";
  }
  return formatDecidedByLabel(trimmed);
}

/**
 * Compact Technical Evidence sidebar display for request/correlation values.
 * Strips narrative wrappers that duplicate the field label; does not invent IDs.
 */
export function formatCompactRequestIds(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  const partialNote = /^Partial correlation note:\s*(.+)$/i.exec(trimmed);
  if (partialNote?.[1]) {
    return partialNote[1].trim();
  }
  return trimmed;
}

/**
 * Compact Technical Evidence sidebar display for issue-first-observed text.
 * Strips narrative that duplicates the field label; does not invent dates.
 */
export function formatCompactIssueFirstObserved(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "—") {
    return trimmed;
  }
  const firstNoticed =
    /^First noticed on\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})(?:\s+in\b.*)?$/i.exec(
      trimmed,
    );
  if (firstNoticed?.[1]) {
    return firstNoticed[1];
  }
  return trimmed;
}

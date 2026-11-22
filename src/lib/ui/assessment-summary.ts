import { stripDemoDescriptionBoilerplate } from "@/lib/demo/demo-cases";
import { evidenceTypeLabel } from "@/lib/evidence/evidence-display";
import type {
  TechnicalEvidenceRecord,
  TechnicalEvidenceType,
} from "@/lib/evidence/evidence-types";
import { troubleshootingSummaryLines } from "@/lib/ui/case-display";
import { buildOverviewEvidenceSummary } from "@/lib/ui/overview-evidence-summary";
import type { WorkflowStage } from "@/lib/ui/case-workflow-stages";
import type { CaseRecord, EscalationRecommendation } from "@/types";

export type AssessmentInvestigationSummary = {
  overview: string;
  keyFindings: string[];
};

export type AssessmentEvidenceLink = {
  id: string;
  label: string;
  actionLabel: string;
  evidenceType: TechnicalEvidenceType;
};

export type AssessmentEvidenceSection = {
  /** Heading: Technical evidence | Further investigation required */
  title: "Technical evidence" | "Further investigation required";
  kind: "evidence" | "gaps";
  /** Phase B diagnostic evidence rows with Investigation deep-links. */
  evidenceItems: AssessmentEvidenceLink[];
  /**
   * Outstanding investigation requirements from recorded missingEvidence
   * (presentation only — data model unchanged).
   */
  gaps: string[];
};

export type AssessmentNextAction = {
  summary: string;
  actionLabel: string;
  targetStage: WorkflowStage;
  /** Soft tint for approved escalation next-action card. */
  tone: "approved" | "pending" | "continue";
  /**
   * When false, Assessment shows the next-action text without a navigation
   * button (e.g. insufficient-evidence guidance).
   */
  showNavigation: boolean;
};

export type AssessmentRecommendationDisplay = {
  headline: string;
  explanation: string;
  score: number;
  recommendation: EscalationRecommendation;
};

const DIAGNOSTIC_EVIDENCE_TYPES = new Set<TechnicalEvidenceType>([
  "application_log",
  "datadog_log",
  "datadog_trace",
  "api_response",
  "postman_result",
  "auth_error",
  "screenshot",
  "attachment",
]);

/**
 * Compact Investigation summary for Assessment — from recorded case data only.
 * Omits request IDs, timestamps, and status prose already covered elsewhere.
 * Uses complete sentences (no mid-sentence ellipsis truncation).
 */
export function buildAssessmentInvestigationSummary(
  record: CaseRecord,
): AssessmentInvestigationSummary {
  const description = stripDemoDescriptionBoilerplate(
    record.issueDescription,
  ).trim();

  const proseLines = description
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !isAssessmentSummaryNoiseLine(line));

  let overview = proseLines.slice(0, 2).join(" ").trim();
  if (!overview) {
    overview =
      record.actualBehaviour.replace(/\s+/g, " ").trim() ||
      "No investigation summary is available yet.";
  }

  const keyFindings = troubleshootingSummaryLines(
    record.troubleshootingPerformed,
    3,
  );

  return { overview, keyFindings };
}

function isAssessmentSummaryNoiseLine(line: string): boolean {
  return (
    /^Request ID:/i.test(line) ||
    /^Timestamp:/i.test(line) ||
    /^Trace ID:/i.test(line) ||
    /^Correlation ID:/i.test(line) ||
    /\binvestigation is ongoing\b/i.test(line) ||
    /\bengineering escalation would be premature\b/i.test(line) ||
    /\bmay still need to be ruled out\b/i.test(line) ||
    /\bpossible (cause|root cause)\b/i.test(line)
  );
}

/**
 * Sentence-case recommendation labels for Assessment (presentation only).
 */
export function assessmentRecommendationHeadline(
  recommendation: EscalationRecommendation,
): string {
  switch (recommendation) {
    case "escalate":
      return "Escalate to Engineering";
    case "continue_investigation":
      return "Continue investigation";
    case "insufficient_evidence":
      return "Insufficient evidence";
  }
}

export function buildAssessmentRecommendationDisplay(
  record: CaseRecord,
): AssessmentRecommendationDisplay | null {
  const result = record.escalationResult;
  if (!result) {
    return null;
  }

  return {
    headline: assessmentRecommendationHeadline(result.recommendation),
    explanation: buildOverviewEvidenceSummary(record).recommendationExplanation,
    score: result.escalationScore,
    recommendation: result.recommendation,
  };
}

function evidenceActionLabel(item: TechnicalEvidenceRecord): string {
  switch (item.evidenceType) {
    case "datadog_log":
    case "application_log":
      return "View logs";
    case "datadog_trace":
      return "View trace";
    case "api_response":
      return "View response";
    case "postman_result":
      return "View result";
    case "auth_error":
      return "View error";
    case "screenshot":
      return "View screenshot";
    case "attachment":
      return "View attachment";
    default:
      return "View evidence";
  }
}

function evidenceDisplayLabel(item: TechnicalEvidenceRecord): string {
  const title = item.title
    .replace(/^\[FICTIONAL DEMO\]\s*/i, "")
    .replace(/^\[DEMO\]\s*/i, "")
    .trim();
  if (title) {
    // Prefer full concise title — avoid mid-word ellipsis for scanability.
    return title.length > 100 ? `${title.slice(0, 97).trimEnd()}…` : title;
  }
  return evidenceTypeLabel(item.evidenceType);
}

/**
 * Aligns with Investigation: customer observations / incompleteness notes are
 * not shown as technical diagnostic evidence. Phase B records remain available
 * on the Investigation tab.
 */
export function isAssessmentDiagnosticEvidence(
  item: TechnicalEvidenceRecord,
): boolean {
  const title = item.title.trim();
  const body = (item.body ?? "").trim();

  if (
    /customer[- ]?note/i.test(title) ||
    /observational note only/i.test(title) ||
    /observational note only/i.test(body)
  ) {
    return false;
  }

  if (
    /^Customer-provided note:/i.test(body) ||
    /^Partial customer note:/i.test(body)
  ) {
    return false;
  }

  if (
    /\bNo complete .+ (log package|application logs|webhook) (yet|provided)\b/i.test(
      body,
    ) &&
    !hasDiagnosticArtefactMarkers(body)
  ) {
    return false;
  }

  if (item.evidenceType === "other") {
    return hasDiagnosticArtefactMarkers(body);
  }

  return DIAGNOSTIC_EVIDENCE_TYPES.has(item.evidenceType);
}

function hasDiagnosticArtefactMarkers(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) {
    return false;
  }
  return (
    /\bHTTP status:\s*\d{3}\b/i.test(trimmed) ||
    /\bHTTP\/\d(?:\.\d)?\s+\d{3}\b/i.test(trimmed) ||
    /\b(ERROR|WARN|INFO|DEBUG|FATAL)\b/.test(trimmed) ||
    /\bException\b/.test(trimmed) ||
    /\bstack trace\b/i.test(trimmed) ||
    /\bSignature validation failed\b/i.test(trimmed) ||
    /\b(GET|POST|PUT|PATCH|DELETE)\s+\S+/i.test(trimmed)
  );
}

/**
 * Evidence-rich escalate cases show Technical evidence.
 * Insufficient-evidence / continue-investigation cases with outstanding checks
 * show Further investigation required (from recorded missingEvidence only).
 */
export function buildAssessmentEvidenceSection(
  record: CaseRecord,
): AssessmentEvidenceSection | null {
  const phaseB = [...(record.technicalEvidence ?? [])]
    .filter(isAssessmentDiagnosticEvidence)
    .sort(
      (a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt),
    )
    .slice(0, 4);

  const gaps = (record.analysis?.aiResult.missingEvidence ?? [])
    .map((item) => formatInvestigationRequirement(item))
    .filter(Boolean)
    .slice(0, 4);

  const recommendation = record.escalationResult?.recommendation;
  const needsFurtherInvestigation =
    recommendation === "insufficient_evidence" ||
    recommendation === "continue_investigation";

  if (needsFurtherInvestigation && gaps.length > 0) {
    return {
      title: "Further investigation required",
      kind: "gaps",
      evidenceItems: [],
      gaps,
    };
  }

  if (phaseB.length > 0) {
    return {
      title: "Technical evidence",
      kind: "evidence",
      evidenceItems: phaseB.map((item) => ({
        id: item.id,
        label: evidenceDisplayLabel(item),
        actionLabel: evidenceActionLabel(item),
        evidenceType: item.evidenceType,
      })),
      gaps: [],
    };
  }

  if (gaps.length > 0) {
    return {
      title: "Further investigation required",
      kind: "gaps",
      evidenceItems: [],
      gaps,
    };
  }

  return null;
}

/**
 * Presentation-only polish for recorded missing-evidence strings.
 * Does not invent requirements or change stored analysis data.
 */
export function formatInvestigationRequirement(raw: string): string {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "";
  }
  // Drop trailing period for compact checklist scanning.
  return trimmed.replace(/\.+$/, "");
}

/**
 * Contextual Assessment next action — presentation only.
 * Uses recorded recommendation and missingEvidence; does not invent integrations.
 */
export function buildAssessmentNextAction(
  record: CaseRecord,
): AssessmentNextAction {
  const approved =
    record.decision?.decision === "approved" && Boolean(record.handoff);

  if (approved || record.status === "escalated") {
    return {
      summary: "Escalation approved. Open Create escalation.",
      actionLabel: "Open Create escalation",
      targetStage: "Create escalation",
      tone: "approved",
      showNavigation: true,
    };
  }

  const recommendation = record.escalationResult?.recommendation;
  const primaryGap = (record.analysis?.aiResult.missingEvidence ?? [])
    .map((item) => formatInvestigationRequirement(item))
    .find(Boolean);
  const primaryStep = record.analysis?.aiResult.recommendedNextSteps?.[0]
    ?.replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "");

  if (recommendation === "insufficient_evidence") {
    const authGap =
      primaryGap &&
      /saml|auth|assertion|certificate|login/i.test(primaryGap);
    const collect = authGap
      ? "Request the missing authentication evidence from the customer or collect it internally."
      : primaryGap
        ? `Request the missing evidence from the customer or collect it internally (${primaryGap}).`
        : "Request the missing evidence from the customer or collect it internally.";
    return {
      summary: `${collect} Adding evidence records it on the case; it does not automatically update this assessment.`,
      actionLabel: "Open Investigation",
      targetStage: "Investigation",
      tone: "continue",
      showNavigation: false,
    };
  }

  if (
    recommendation === "continue_investigation" ||
    record.status === "investigation_continues"
  ) {
    return {
      summary: primaryStep
        ? `${primaryStep}. Also review related support tickets, Jira issues, or previous incidents for similar failures.`
        : "Continue troubleshooting and review related support tickets, Jira issues, or previous incidents for similar failures.",
      actionLabel: "Open Investigation",
      targetStage: "Investigation",
      tone: "continue",
      showNavigation: true,
    };
  }

  if (
    recommendation === "escalate" &&
    record.status === "awaiting_decision" &&
    !record.decision
  ) {
    return {
      summary:
        "Record Escalation approval before Create escalation is available.",
      actionLabel: "Go to Escalation approval",
      targetStage: "Escalation approval",
      tone: "pending",
      showNavigation: true,
    };
  }

  if (record.status === "awaiting_decision" && !record.decision) {
    return {
      summary:
        "Review the engine recommendation, then record Escalation approval or continue investigation.",
      actionLabel: "Go to Escalation approval",
      targetStage: "Escalation approval",
      tone: "pending",
      showNavigation: true,
    };
  }

  return {
    summary: "Continue gathering evidence in Investigation.",
    actionLabel: "Open Investigation",
    targetStage: "Investigation",
    tone: "continue",
    showNavigation: true,
  };
}

/** User-facing label for a recorded human decision (not the engine recommendation). */
export function recordedDecisionLabel(
  decision: NonNullable<CaseRecord["decision"]>["decision"],
): string {
  return decision === "approved"
    ? "Escalation approved"
    : "Continue investigation recorded";
}

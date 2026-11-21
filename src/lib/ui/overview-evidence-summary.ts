import type { CaseTabId } from "@/components/cases/CaseWorkspaceTabs";
import { shortenText } from "@/lib/ui/case-display";
import type { CaseRecord, EscalationRecommendation } from "@/types";

export type OverviewNextAction = {
  title: string;
  summary: string;
  actionLabel: string;
  targetTab: CaseTabId;
};

export type OverviewEvidenceSummary = {
  /** Short paragraph explaining why the recommendation was reached. */
  recommendationExplanation: string;
  nextAction: OverviewNextAction;
};

/**
 * Overview presentation helpers from existing validated case data.
 * Does not invent evidence or alter scoring / recommendation logic.
 */
export function buildOverviewEvidenceSummary(
  record: CaseRecord,
): OverviewEvidenceSummary {
  return {
    recommendationExplanation: buildRecommendationExplanation(record),
    nextAction: buildNextAction(record),
  };
}

/**
 * Evidence-based explanation — skips score-restating lines from engine reasons.
 */
function buildRecommendationExplanation(record: CaseRecord): string {
  const result = record.escalationResult;
  if (!result) {
    return "Escalation recommendation is not available yet.";
  }

  const narrativeReasons = result.recommendationReasons
    .map((reason) => reason.trim())
    .filter(Boolean)
    .filter((reason) => !isScoreRestatement(reason));

  const factorReasons = result.contributingFactors
    .filter((factor) => factor.weight !== 0)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .map((factor) => factor.reason.trim())
    .filter(Boolean);

  const missing = (record.analysis?.aiResult.missingEvidence ?? [])
    .map((item) => item.trim())
    .filter(Boolean);

  const established = (record.analysis?.validatedEvidence ?? [])
    .map((item) => item.description.trim())
    .filter(Boolean);

  const parts: string[] = [];

  if (narrativeReasons[0]) {
    parts.push(narrativeReasons[0]);
  } else if (factorReasons[0]) {
    parts.push(factorReasons[0]);
  }

  if (result.recommendation === "insufficient_evidence" && missing[0]) {
    parts.push(`Key gap: ${missing[0]}.`);
  } else if (
    result.recommendation === "continue_investigation" &&
    missing[0]
  ) {
    parts.push(`Further evidence still needed: ${missing[0]}.`);
  } else if (result.recommendation === "escalate" && established[0]) {
    parts.push(`Supported by validated evidence such as ${established[0]}.`);
  } else if (narrativeReasons[1]) {
    parts.push(narrativeReasons[1]);
  } else if (factorReasons[1] && factorReasons[1] !== parts[0]) {
    parts.push(factorReasons[1]);
  }

  if (parts.length === 0) {
    return defaultExplanationForRecommendation(result.recommendation);
  }

  return shortenText(parts.join(" "), 240);
}

function isScoreRestatement(reason: string): boolean {
  return (
    /^deterministic score is\b/i.test(reason) ||
    /\b\d+\s*\/\s*100\b/.test(reason)
  );
}

function defaultExplanationForRecommendation(
  recommendation: EscalationRecommendation,
): string {
  switch (recommendation) {
    case "escalate":
      return "Validated case evidence and deterministic assessment support escalation for human review.";
    case "continue_investigation":
      return "Validated case evidence and deterministic assessment indicate continued investigation before escalation.";
    case "insufficient_evidence":
      return "Validated case evidence and deterministic assessment indicate insufficient evidence for escalation.";
    default:
      return "Recommendation is based on deterministic assessment of validated case evidence.";
  }
}

function buildNextAction(record: CaseRecord): OverviewNextAction {
  const approved =
    record.decision?.decision === "approved" && Boolean(record.handoff);

  if (approved) {
    return {
      title: "Open Engineering handoff",
      summary:
        "Escalation is approved. Review the handoff and create the Jira escalation or Rootly incident.",
      actionLabel: "Open handoff",
      targetTab: "handoff",
    };
  }

  if (
    record.status === "awaiting_decision" &&
    record.escalationResult &&
    !record.decision
  ) {
    return {
      title: "Record human decision",
      summary:
        "Review the assessment if needed, then record your decision in the form below.",
      actionLabel: "Open assessment",
      targetTab: "assessment",
    };
  }

  if (record.status === "investigation_continues") {
    return {
      title: "Open Investigation",
      summary:
        record.analysis?.aiResult.recommendedNextSteps?.[0]?.trim() ||
        "Gather the remaining evidence before reconsidering escalation.",
      actionLabel: "Open investigation",
      targetTab: "investigation",
    };
  }

  const recommended = record.analysis?.aiResult.recommendedNextSteps?.[0]?.trim();
  if (recommended) {
    return {
      title: "Open Investigation",
      summary: shortenText(recommended, 140),
      actionLabel: "Open investigation",
      targetTab: "investigation",
    };
  }

  return {
    title: "Open Investigation",
    summary: "Continue gathering evidence in Investigation.",
    actionLabel: "Open investigation",
    targetTab: "investigation",
  };
}

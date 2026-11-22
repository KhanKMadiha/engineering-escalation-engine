import type { CaseStatus, EscalationRecommendation } from "@/types";

/**
 * Presentation-only workflow stages for the case stepper.
 * Maps existing CaseStatus values — does not introduce new workflow states.
 */
export const WORKFLOW_STAGES = [
  "Case details",
  "Investigation",
  "Assessment",
  "Escalation approval",
  "Create escalation",
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export type WorkflowStageAvailabilityInput = {
  status: CaseStatus;
  recommendation?: EscalationRecommendation | null;
};

/**
 * Derives the current visual stage from the case status.
 * Pure presentation mapping; status machine remains authoritative.
 * Legacy awaiting_decision + non-escalate rows open on Investigation.
 */
export function workflowStageForStatus(
  status: CaseStatus,
  recommendation?: EscalationRecommendation | null,
): WorkflowStage {
  if (
    status === "awaiting_decision" &&
    recommendation != null &&
    recommendation !== "escalate"
  ) {
    return "Investigation";
  }

  switch (status) {
    case "draft":
    case "submitted":
      return "Case details";
    case "analyzing":
      return "Investigation";
    case "awaiting_decision":
      return "Escalation approval";
    case "escalated":
      return "Create escalation";
    case "investigation_continues":
      return "Investigation";
    case "closed":
      return "Create escalation";
    default:
      return "Case details";
  }
}

/**
 * Index of the active stage (0-based) for stepper highlighting.
 */
export function workflowStageIndex(
  status: CaseStatus,
  recommendation?: EscalationRecommendation | null,
): number {
  const stage = workflowStageForStatus(status, recommendation);
  return WORKFLOW_STAGES.indexOf(stage);
}

/**
 * Whether a workflow stage is available for normal navigation.
 * Stages remain visible when unavailable; steppers must disable them.
 *
 * Escalation approval requires ordinary escalate eligibility (or a recorded
 * escalation). Create escalation requires an approved/escalated case.
 */
export function isWorkflowStageAvailable(
  stage: WorkflowStage,
  status: CaseStatus,
  recommendation?: EscalationRecommendation | null,
): boolean {
  if (
    stage === "Case details" ||
    stage === "Investigation" ||
    stage === "Assessment"
  ) {
    return true;
  }

  const escalateReady =
    status === "awaiting_decision" &&
    (recommendation == null || recommendation === "escalate");

  if (stage === "Escalation approval") {
    return (
      escalateReady || status === "escalated" || status === "closed"
    );
  }

  if (stage === "Create escalation") {
    return status === "escalated" || status === "closed";
  }

  return false;
}

/**
 * Accessible reason when a stage is visible but not navigable.
 */
export function workflowStageUnavailableReason(
  stage: WorkflowStage,
  status: CaseStatus,
  recommendation?: EscalationRecommendation | null,
): string | null {
  if (isWorkflowStageAvailable(stage, status, recommendation)) {
    return null;
  }

  if (stage === "Escalation approval") {
    if (
      status === "investigation_continues" ||
      (status === "awaiting_decision" &&
        recommendation != null &&
        recommendation !== "escalate")
    ) {
      return "Escalation approval is not required while investigation continues.";
    }
    return "Escalation approval becomes available when the engine recommends Engineering escalation.";
  }

  if (stage === "Create escalation") {
    if (status === "awaiting_decision" && recommendation === "escalate") {
      return "Create escalation becomes available after escalation is approved.";
    }
    if (
      status === "investigation_continues" ||
      (status === "awaiting_decision" &&
        recommendation != null &&
        recommendation !== "escalate")
    ) {
      return "Create escalation is unavailable while investigation continues.";
    }
    return "Create escalation becomes available after escalation is approved.";
  }

  return "This workflow stage is not available for the current case status.";
}

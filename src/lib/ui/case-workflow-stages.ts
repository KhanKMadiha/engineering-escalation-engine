import type { CaseStatus } from "@/types";

/**
 * Presentation-only workflow stages for the case stepper.
 * Maps existing CaseStatus values — does not introduce new workflow states.
 */
export const WORKFLOW_STAGES = [
  "Case details",
  "Investigation",
  "Assessment",
  "Human decision",
  "Handoff",
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

/**
 * Derives the current visual stage from the case status.
 * Pure presentation mapping; status machine remains authoritative.
 */
export function workflowStageForStatus(status: CaseStatus): WorkflowStage {
  switch (status) {
    case "draft":
    case "submitted":
      return "Case details";
    case "analyzing":
      return "Investigation";
    case "awaiting_decision":
      return "Human decision";
    case "escalated":
      return "Handoff";
    case "investigation_continues":
      return "Investigation";
    case "closed":
      return "Handoff";
    default:
      return "Case details";
  }
}

/**
 * Index of the active stage (0-based) for stepper highlighting.
 */
export function workflowStageIndex(status: CaseStatus): number {
  const stage = workflowStageForStatus(status);
  return WORKFLOW_STAGES.indexOf(stage);
}

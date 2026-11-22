import type { CaseStatus, EscalationRecommendation } from "@/types";

/**
 * Allowed status transitions for the case lifecycle.
 * Phase 2 enforces the graph; later phases drive transitions via services.
 *
 * Phase 1 routing: after assessment, escalate → awaiting_decision;
 * continue_investigation / insufficient_evidence → investigation_continues
 * (direct from analyzing). Escalated remains DecisionService-only.
 */
export const CASE_STATUS_TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> =
  {
    draft: ["submitted", "closed"],
    submitted: ["analyzing", "closed"],
    analyzing: [
      "awaiting_decision",
      "investigation_continues",
      "submitted",
      "closed",
    ],
    awaiting_decision: [
      "analyzing",
      "escalated",
      "investigation_continues",
      "closed",
    ],
    escalated: ["closed"],
    investigation_continues: ["submitted", "closed"],
    closed: [],
  };

/**
 * Post-assessment lifecycle target from the engine recommendation.
 * Does not approve escalation or create a handoff.
 */
export function statusAfterEscalationRecommendation(
  recommendation: EscalationRecommendation,
): Extract<CaseStatus, "awaiting_decision" | "investigation_continues"> {
  return recommendation === "escalate"
    ? "awaiting_decision"
    : "investigation_continues";
}

export class InvalidStatusTransitionError extends Error {
  readonly from: CaseStatus;
  readonly to: CaseStatus;

  constructor(from: CaseStatus, to: CaseStatus) {
    super(`Invalid status transition: ${from} → ${to}`);
    this.name = "InvalidStatusTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function canTransition(
  from: CaseStatus,
  to: CaseStatus,
): boolean {
  if (from === to) {
    return false;
  }
  return CASE_STATUS_TRANSITIONS[from].includes(to);
}

export function assertValidTransition(
  from: CaseStatus,
  to: CaseStatus,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidStatusTransitionError(from, to);
  }
}

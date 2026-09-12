import type { CaseStatus } from "@/types";

/**
 * Allowed status transitions for the case lifecycle.
 * Phase 2 enforces the graph; later phases drive transitions via services.
 */
export const CASE_STATUS_TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> =
  {
    draft: ["submitted", "closed"],
    submitted: ["analyzing", "closed"],
    analyzing: ["awaiting_decision", "submitted", "closed"],
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

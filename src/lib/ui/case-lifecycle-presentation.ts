import type {
  CaseStatus,
  EscalationRecommendation,
  SupportCaseSummary,
} from "@/types";

/**
 * Ordinary Escalation approval queue eligibility.
 * Domain routing should set status=awaiting_decision only for escalate
 * recommendations; this also protects legacy hosted rows that still have
 * insufficient/continue recommendations with awaiting_decision status.
 */
export function isAwaitingOrdinaryEscalationApproval(input: {
  status: SupportCaseSummary["status"];
  escalationRecommendation?: EscalationRecommendation | null;
}): boolean {
  return (
    input.status === "awaiting_decision" &&
    input.escalationRecommendation === "escalate"
  );
}

/**
 * Cases that should present as continuing investigation in queues/navigation,
 * including legacy awaiting_decision rows with non-escalate recommendations.
 */
export function presentsAsInvestigationContinues(input: {
  status: SupportCaseSummary["status"];
  escalationRecommendation?: EscalationRecommendation | null;
}): boolean {
  if (input.status === "investigation_continues") {
    return true;
  }
  return (
    input.status === "awaiting_decision" &&
    input.escalationRecommendation != null &&
    input.escalationRecommendation !== "escalate"
  );
}

/**
 * Lifecycle status shown in queues/headers.
 * Presentation only — does not rewrite stored status.
 */
export function displayLifecycleStatus(input: {
  status: CaseStatus;
  escalationRecommendation?: EscalationRecommendation | null;
}): CaseStatus {
  if (presentsAsInvestigationContinues(input)) {
    return "investigation_continues";
  }
  return input.status;
}

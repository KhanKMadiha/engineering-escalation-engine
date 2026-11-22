import { isAwaitingOrdinaryEscalationApproval } from "@/lib/ui/case-lifecycle-presentation";
import type { SupportCaseSummary } from "@/types";

/**
 * Dashboard metrics derived only from existing case list data.
 * Pending-review counts follow ordinary escalate approval eligibility
 * (status + escalate recommendation), not every awaiting_decision row.
 */
export function buildCaseQueueStats(cases: SupportCaseSummary[]) {
  let awaitingReview = 0;
  let readyForHandoff = 0;
  let inProgress = 0;

  for (const item of cases) {
    if (
      isAwaitingOrdinaryEscalationApproval({
        status: item.status,
        escalationRecommendation: item.escalationRecommendation,
      })
    ) {
      awaitingReview += 1;
    }
    if (item.status === "escalated") {
      readyForHandoff += 1;
    }
    if (
      item.status === "draft" ||
      item.status === "submitted" ||
      item.status === "analyzing" ||
      item.status === "investigation_continues" ||
      (item.status === "awaiting_decision" &&
        item.escalationRecommendation != null &&
        item.escalationRecommendation !== "escalate")
    ) {
      inProgress += 1;
    }
  }

  return {
    awaitingReview,
    readyForHandoff,
    inProgress,
    total: cases.length,
  };
}

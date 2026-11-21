import type { SupportCaseSummary } from "@/types";

/**
 * Dashboard metrics derived only from existing case list data.
 * Does not invent averages or placeholder statistics.
 */
export function buildCaseQueueStats(cases: SupportCaseSummary[]) {
  let awaitingReview = 0;
  let readyForHandoff = 0;
  let inProgress = 0;

  for (const item of cases) {
    if (item.status === "awaiting_decision") {
      awaitingReview += 1;
    }
    if (item.status === "escalated") {
      readyForHandoff += 1;
    }
    if (
      item.status === "draft" ||
      item.status === "submitted" ||
      item.status === "analyzing" ||
      item.status === "investigation_continues"
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

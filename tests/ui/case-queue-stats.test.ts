import { describe, expect, it } from "vitest";
import { buildCaseQueueStats } from "@/lib/ui/case-queue-stats";
import type { SupportCaseSummary } from "@/types";

function summary(
  partial: Partial<SupportCaseSummary> & Pick<SupportCaseSummary, "status">,
): SupportCaseSummary {
  return {
    id: partial.id ?? "id",
    customer: partial.customer ?? "Customer",
    product: partial.product ?? "Product",
    severity: partial.severity ?? "high",
    issueTitle: partial.issueTitle ?? "Issue",
    environment: partial.environment ?? "production",
    status: partial.status,
    createdAt: partial.createdAt ?? "2026-09-08T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-09-08T00:00:00.000Z",
    escalationRecommendation: partial.escalationRecommendation,
    escalationScore: partial.escalationScore,
  };
}

describe("buildCaseQueueStats", () => {
  it("counts only real statuses from the case list", () => {
    const stats = buildCaseQueueStats([
      summary({ status: "awaiting_decision" }),
      summary({ status: "awaiting_decision" }),
      summary({ status: "escalated" }),
      summary({ status: "investigation_continues" }),
      summary({ status: "analyzing" }),
    ]);
    expect(stats).toEqual({
      awaitingReview: 2,
      readyForHandoff: 1,
      inProgress: 2,
      total: 5,
    });
  });
});

import { FilteredCaseQueue } from "@/components/cases/FilteredCaseQueue";
import { listVisibleCases } from "@/lib/demo/list-visible-cases";
import { isAwaitingOrdinaryEscalationApproval } from "@/lib/ui/case-lifecycle-presentation";

export const dynamic = "force-dynamic";

/**
 * Operations view: cases awaiting ordinary Escalation approval.
 * Filters to escalate recommendations so insufficient/continue cases do not
 * appear merely because an assessment completed (including legacy hosted rows).
 * Scoped to shared templates + the visitor's private workspace forks.
 */
export default async function PendingReviewsPage() {
  const cases = (
    await listVisibleCases({ status: "awaiting_decision" })
  ).filter((item) =>
    isAwaitingOrdinaryEscalationApproval({
      status: item.status,
      escalationRecommendation: item.escalationRecommendation,
    }),
  );

  return (
    <FilteredCaseQueue
      cases={cases}
      title="Pending reviews"
      description="Cases awaiting Escalation approval before an Engineering handoff can be created. Engine recommendations are advisory until a human decision is recorded."
      emptyTitle="No cases awaiting review"
      emptyDescription="When analysis recommends Engineering escalation, the case will appear here for human approval."
    />
  );
}

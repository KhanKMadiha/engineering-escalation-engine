import { FilteredCaseQueue } from "@/components/cases/FilteredCaseQueue";
import { getCaseService } from "@/lib/cases/get-case-service";

export const dynamic = "force-dynamic";

/**
 * Operations view: cases awaiting human review (status = awaiting_decision).
 */
export default async function PendingReviewsPage() {
  const cases = await getCaseService().listCases({
    status: "awaiting_decision",
  });

  return (
    <FilteredCaseQueue
      cases={cases}
      title="Pending reviews"
      description="Cases that have an escalation recommendation and require a human decision before Engineering handoff."
      emptyTitle="No cases awaiting review"
      emptyDescription="When analysis completes and a case reaches awaiting decision, it will appear here."
    />
  );
}

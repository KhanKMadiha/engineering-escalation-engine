import { FilteredCaseQueue } from "@/components/cases/FilteredCaseQueue";
import { listVisibleCases } from "@/lib/demo/list-visible-cases";

export const dynamic = "force-dynamic";

/**
 * Operations view: cases with Engineering handoffs available (status = escalated).
 * Escalation still requires prior human approval — this status is set only after approve.
 * Scoped to shared templates + the visitor's private workspace forks.
 */
export default async function HandoffsPage() {
  const cases = await listVisibleCases({ status: "escalated" });

  return (
    <FilteredCaseQueue
      cases={cases}
      title="Handoffs"
      description="Cases approved for Engineering escalation with a structured handoff available. Human approval remains required before a case reaches this list."
      emptyTitle="No handoffs ready"
      emptyDescription="Approved escalations with generated handoffs appear here. Cases still awaiting decision stay under Pending reviews."
    />
  );
}

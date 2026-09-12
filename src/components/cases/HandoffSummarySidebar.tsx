import { SidebarMetaRow } from "@/components/cases/SidebarMetaRow";
import {
  formatRecommendationLabel,
  formatReviewerDisplayLabel,
} from "@/lib/ui/case-display";
import { formatDateTime } from "@/lib/format";
import type { CaseRecord } from "@/types";

type HandoffSummarySidebarProps = {
  record: CaseRecord;
};

/**
 * Compact handoff / decision context for the Handoff tab sidebar.
 * Presentation only — uses existing handoff and human decision data.
 */
export function HandoffSummarySidebar({ record }: HandoffSummarySidebarProps) {
  const handoff = record.handoff;
  const decision = record.decision;

  if (!handoff || !decision || decision.decision !== "approved") {
    return null;
  }

  const reviewer = decision.decidedBy?.trim()
    ? formatReviewerDisplayLabel(decision.decidedBy)
    : null;

  return (
    <aside className="min-w-0">
      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Handoff summary
        </h2>
        <dl className="mt-3 space-y-2">
          <SidebarMetaRow label="Status">Ready for Engineering</SidebarMetaRow>
          <SidebarMetaRow label="Decision">Approved</SidebarMetaRow>
          <SidebarMetaRow label="Recommendation">
            {formatRecommendationLabel(handoff.escalationRecommendation)}
          </SidebarMetaRow>
          <SidebarMetaRow label="Score">
            {handoff.escalationScore} / 100
          </SidebarMetaRow>
          <SidebarMetaRow label="Affected customer count">
            {handoff.affectedCustomerCount === null
              ? "—"
              : handoff.affectedCustomerCount}
          </SidebarMetaRow>
        </dl>
      </section>

      <section className="mt-6 border-t border-slate-200 pt-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Decision
        </h2>
        <dl className="mt-3 space-y-2">
          <SidebarMetaRow label="Approved">
            {formatDateTime(decision.decidedAt)}
          </SidebarMetaRow>
          {reviewer ? (
            <SidebarMetaRow label="Reviewer">{reviewer}</SidebarMetaRow>
          ) : null}
          <SidebarMetaRow label="Rationale">
            {decision.rationale.trim() ? (
              <span className="whitespace-pre-wrap text-left sm:text-right">
                {decision.rationale}
              </span>
            ) : (
              "—"
            )}
          </SidebarMetaRow>
        </dl>
      </section>
    </aside>
  );
}

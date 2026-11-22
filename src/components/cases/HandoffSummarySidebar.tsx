import { SidebarMetaRow } from "@/components/cases/SidebarMetaRow";
import { Card } from "@/components/ui/Card";
import { formatReviewerDisplayLabel } from "@/lib/ui/case-display";
import { formatDateTime } from "@/lib/format";
import type { CaseRecord } from "@/types";

type HandoffSummarySidebarProps = {
  record: CaseRecord;
};

/**
 * Compact Decision panel for Create escalation.
 * Reason for escalation lives in the main prepared-escalation content.
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
    <Card padding="lg" className="min-w-0">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">
        Decision
      </h2>
      <dl className="mt-3 space-y-2.5">
        <SidebarMetaRow label="Outcome">Approved</SidebarMetaRow>
        {reviewer ? (
          <SidebarMetaRow label="Reviewer">{reviewer}</SidebarMetaRow>
        ) : null}
        <SidebarMetaRow label="Approved">
          {formatDateTime(decision.decidedAt)}
        </SidebarMetaRow>
      </dl>
    </Card>
  );
}

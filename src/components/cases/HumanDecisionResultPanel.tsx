import { WorkflowSection } from "@/components/ui/WorkflowSection";
import { formatDateTime } from "@/lib/format";
import { formatDecidedByLabel } from "@/lib/ui/case-display";
import type { CaseStatus, HumanDecision } from "@/types";

type HumanDecisionResultPanelProps = {
  decision: HumanDecision;
  caseStatus: CaseStatus;
};

/**
 * Human decision summary for Overview.
 * Presentation only — does not alter stored decision values.
 */
export function HumanDecisionResultPanel({
  decision,
  caseStatus,
}: HumanDecisionResultPanelProps) {
  const approved = decision.decision === "approved";
  const continueInvestigation =
    !approved && caseStatus === "investigation_continues";

  const outcomeLabel = approved
    ? "✓ Escalation approved"
    : continueInvestigation
      ? "Continue investigation"
      : "Escalation rejected";

  return (
    <WorkflowSection title="Human decision">
      <div
        className={`inline-flex rounded border px-3 py-2 text-sm font-semibold ${
          approved
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : continueInvestigation
              ? "border-orange-200 bg-orange-50 text-orange-950"
              : "border-slate-200 bg-slate-50 text-slate-800"
        }`}
        role="status"
      >
        {outcomeLabel}
      </div>

      <dl className="mt-4 grid max-w-2xl gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-slate-500">Decided by</dt>
          <dd className="font-medium text-slate-900">
            {formatDecidedByLabel(decision.decidedBy)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Decided</dt>
          <dd className="text-slate-800">
            {formatDateTime(decision.decidedAt)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">Rationale</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-slate-800">
            {decision.rationale}
          </dd>
        </div>
      </dl>
    </WorkflowSection>
  );
}

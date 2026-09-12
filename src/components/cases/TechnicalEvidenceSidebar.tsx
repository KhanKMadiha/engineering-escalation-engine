import { SidebarMetaRow } from "@/components/cases/SidebarMetaRow";
import { formatIssueFirstObserved } from "@/lib/format";
import {
  formatCompactIssueFirstObserved,
  formatCompactRequestIds,
} from "@/lib/ui/case-display";
import type { CaseRecord } from "@/types";

type TechnicalEvidenceSidebarProps = {
  record: CaseRecord;
};

/**
 * Compact technical evidence rail for the Investigation tab.
 * Presentation only — does not invent or mutate case evidence.
 */
export function TechnicalEvidenceSidebar({
  record,
}: TechnicalEvidenceSidebarProps) {
  const observed = formatCompactIssueFirstObserved(
    formatIssueFirstObserved({
      issueFirstObserved: record.issueFirstObserved,
      incidentTimestamp: record.incidentTimestamp,
    }),
  );
  const requestIdsDisplay = record.requestIds.trim()
    ? formatCompactRequestIds(record.requestIds)
    : "—";

  return (
    <aside className="min-w-0">
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Technical evidence
      </h2>

      <div className="mt-3 space-y-4">
        <div>
          <h3 className="text-xs font-medium text-slate-500">Logs / errors</h3>
          {record.logsErrors.trim() ? (
            <pre className="mt-1.5 max-h-72 overflow-auto rounded border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
              {record.logsErrors}
            </pre>
          ) : (
            <p className="mt-1.5 text-sm text-slate-500">—</p>
          )}
        </div>

        <dl className="space-y-2 border-t border-slate-100 pt-3">
          <SidebarMetaRow
            label={
              record.product === "MS Teams Integration"
                ? "Correlation reference"
                : "Request ID"
            }
          >
            <span className="break-all font-mono text-[12px]">
              {requestIdsDisplay}
            </span>
          </SidebarMetaRow>
          <SidebarMetaRow label="Issue first observed">
            {observed}
          </SidebarMetaRow>
          <SidebarMetaRow label="Affected customer count">
            {record.affectedCustomerCount === null
              ? "—"
              : record.affectedCustomerCount}
          </SidebarMetaRow>
        </dl>
      </div>
    </aside>
  );
}

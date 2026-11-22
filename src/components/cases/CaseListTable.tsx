import Link from "next/link";
import { SeverityBadge, StatusBadge } from "@/components/cases/StatusBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { stripDemoMarkerPrefix } from "@/lib/demo/demo-cases";
import { formatDateTimeParts } from "@/lib/format";
import {
  formatCaseKey,
  formatRecommendationLabel,
} from "@/lib/ui/case-display";
import { demoCaseOwnershipLabel } from "@/lib/ui/demo-case-labels";
import type { SupportCaseSummary } from "@/types";

type CaseListTableProps = {
  cases: SupportCaseSummary[];
};

function RecommendationCell({ item }: { item: SupportCaseSummary }) {
  if (!item.escalationRecommendation) {
    return <span className="text-muted">—</span>;
  }

  return (
    <span className="block break-words font-medium text-foreground">
      {formatRecommendationLabel(item.escalationRecommendation)}
    </span>
  );
}

function UpdatedCell({ value }: { value: string }) {
  const parts = formatDateTimeParts(value);
  if (!parts) {
    return <span className="text-muted">—</span>;
  }

  return (
    <time dateTime={value} className="block whitespace-nowrap text-muted">
      {parts.date}
    </time>
  );
}

const headClass =
  "px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted first:pl-5 last:pr-7 sm:px-3.5 sm:first:pl-6 sm:last:pr-8";
const cellClass =
  "px-3 py-4 align-top first:pl-5 last:pr-7 sm:px-3.5 sm:first:pl-6 sm:last:pr-8";

/**
 * Case queue — Case ID | Issue | Customer | Severity | Status | Recommendation | Updated.
 * Product / environment / reported live on Case Detail, not in the queue row.
 */
export function CaseListTable({ cases }: CaseListTableProps) {
  if (cases.length === 0) {
    return (
      <EmptyState
        title="No cases match"
        description="Create a support case to capture customer-provided evidence and begin the escalation review workflow, or adjust search and filters."
        action={
          <Link href="/cases/new">
            <Button variant="primary" size="sm">
              Create first case
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)] xl:block">
        <table className="w-full table-fixed text-left text-[15px]">
          <colgroup>
            <col style={{ width: "9%" }} />
            <col style={{ width: "32%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "11%" }} />
          </colgroup>
          <thead className="border-b border-border bg-subtle">
            <tr>
              <th scope="col" className={headClass}>
                Case ID
              </th>
              <th scope="col" className={headClass}>
                Issue
              </th>
              <th scope="col" className={headClass}>
                Customer
              </th>
              <th scope="col" className={headClass}>
                Severity
              </th>
              <th scope="col" className={headClass}>
                Status
              </th>
              <th scope="col" className={headClass}>
                Recommendation
              </th>
              <th scope="col" className={headClass}>
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cases.map((item) => {
              const customerLabel = stripDemoMarkerPrefix(item.customer);
              const issueLabel = stripDemoMarkerPrefix(item.issueTitle);
              const caseKey = formatCaseKey(item.id);
              const ownership = demoCaseOwnershipLabel(item);

              return (
                <tr key={item.id} className="hover:bg-subtle/70">
                  <td className={cellClass}>
                    <Link
                      href={`/cases/${item.id}`}
                      className="font-mono text-xs font-medium text-muted hover:text-foreground hover:underline"
                      title={`Case ${caseKey}`}
                    >
                      {caseKey}
                    </Link>
                    {ownership ? (
                      <p className="mt-1 text-[11px] font-medium text-muted">
                        {ownership}
                      </p>
                    ) : null}
                  </td>
                  <td className={cellClass}>
                    <Link
                      href={`/cases/${item.id}`}
                      className="block break-words font-semibold text-foreground hover:underline"
                      title={issueLabel}
                    >
                      {issueLabel}
                    </Link>
                  </td>
                  <td
                    className={`${cellClass} break-words font-medium text-foreground`}
                  >
                    <Link
                      href={`/cases/${item.id}`}
                      className="hover:underline"
                    >
                      {customerLabel}
                    </Link>
                  </td>
                  <td className={cellClass}>
                    <SeverityBadge severity={item.severity} />
                  </td>
                  <td className={cellClass}>
                    <StatusBadge
                      status={item.status}
                      recommendation={item.escalationRecommendation}
                    />
                  </td>
                  <td className={cellClass}>
                    <RecommendationCell item={item} />
                  </td>
                  <td className={`${cellClass} whitespace-nowrap`}>
                    <UpdatedCell value={item.updatedAt} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 xl:hidden">
        {cases.map((item) => {
          const customerLabel = stripDemoMarkerPrefix(item.customer);
          const issueLabel = stripDemoMarkerPrefix(item.issueTitle);
          const updated = formatDateTimeParts(item.updatedAt)?.date;
          const caseKey = formatCaseKey(item.id);
          const ownership = demoCaseOwnershipLabel(item);

          return (
            <li key={item.id}>
              <Link
                href={`/cases/${item.id}`}
                className="block rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] outline-none transition-colors hover:bg-subtle/50 focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-medium text-muted">
                    {caseKey}
                  </span>
                  {ownership ? (
                    <span className="text-[11px] font-medium text-muted">
                      {ownership}
                    </span>
                  ) : null}
                  <SeverityBadge severity={item.severity} />
                  <StatusBadge
                    status={item.status}
                    recommendation={item.escalationRecommendation}
                  />
                </div>
                <p className="mt-2 text-[15px] font-semibold text-foreground">
                  {issueLabel}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {customerLabel}
                </p>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-border pt-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Recommendation
                    </p>
                    <div className="mt-0.5 text-[15px]">
                      <RecommendationCell item={item} />
                    </div>
                  </div>
                  {updated ? (
                    <time
                      dateTime={item.updatedAt}
                      className="shrink-0 text-sm text-muted"
                    >
                      Updated {updated}
                    </time>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

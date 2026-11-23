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
import type { SupportCaseSummary } from "@/types";

type CaseListTableProps = {
  cases: SupportCaseSummary[];
};

function RecommendationCell({ item }: { item: SupportCaseSummary }) {
  if (!item.escalationRecommendation) {
    return <span className="text-muted">—</span>;
  }

  return (
    <span className="block break-words text-[15px] font-normal text-foreground">
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
    <time dateTime={value} className="block whitespace-nowrap text-[15px] text-muted">
      {parts.date}
    </time>
  );
}

const headClass =
  "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted first:pl-4 last:pr-4 sm:px-3.5 sm:first:pl-5 sm:last:pr-5";
const cellClass =
  "px-3 py-3.5 align-middle first:pl-4 last:pr-4 sm:px-3.5 sm:py-4 sm:first:pl-5 sm:last:pr-5";

/**
 * Case queue — Case ID | Issue | Customer | Severity | Status | Recommendation | Updated.
 * Ownership context lives in the global DEMO notice, not per-row labels.
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
      <div className="hidden xl:block">
        <table className="w-full table-fixed text-left text-[15px]">
          <colgroup>
            <col style={{ width: "10%" }} />
            <col style={{ width: "32%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "8%" }} />
          </colgroup>
          <thead className="border-b border-border">
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

              return (
                <tr
                  key={item.id}
                  className="transition-colors hover:bg-subtle focus-within:bg-subtle"
                >
                  <td className={cellClass}>
                    <Link
                      href={`/cases/${item.id}`}
                      className="font-mono text-[13px] font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                      title={`Case ${caseKey}`}
                    >
                      {caseKey}
                    </Link>
                  </td>
                  <td className={cellClass}>
                    <Link
                      href={`/cases/${item.id}`}
                      className="block break-words text-[15px] font-medium leading-snug text-foreground hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                      title={issueLabel}
                    >
                      {issueLabel}
                    </Link>
                  </td>
                  <td className={`${cellClass} break-words`}>
                    <Link
                      href={`/cases/${item.id}`}
                      className="text-[15px] font-normal text-foreground hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
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

          return (
            <li key={item.id}>
              <Link
                href={`/cases/${item.id}`}
                className="block rounded-[var(--radius-card)] border border-border bg-surface p-3.5 outline-none transition-colors hover:border-[#d1d5db] hover:bg-subtle focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[13px] font-semibold text-accent">
                    {caseKey}
                  </span>
                  <SeverityBadge severity={item.severity} />
                  <StatusBadge
                    status={item.status}
                    recommendation={item.escalationRecommendation}
                  />
                </div>
                <p className="mt-2 text-[15px] font-medium leading-snug text-foreground">
                  {issueLabel}
                </p>
                <p className="mt-0.5 text-[15px] font-normal text-foreground">
                  {customerLabel}
                </p>
                <div className="mt-2.5 flex flex-wrap items-end justify-between gap-2 border-t border-border pt-2.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Recommendation
                    </p>
                    <div className="mt-0.5">
                      <RecommendationCell item={item} />
                    </div>
                  </div>
                  {updated ? (
                    <time
                      dateTime={item.updatedAt}
                      className="shrink-0 text-[15px] text-muted"
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

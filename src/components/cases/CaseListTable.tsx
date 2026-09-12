import Link from "next/link";
import { SeverityBadge, StatusBadge } from "@/components/cases/StatusBadge";
import { stripDemoMarkerPrefix } from "@/lib/demo/demo-cases";
import { formatDateTimeParts } from "@/lib/format";
import { formatRecommendationLabel } from "@/lib/ui/case-display";
import type { SupportCaseSummary } from "@/types";

type CaseListTableProps = {
  cases: SupportCaseSummary[];
};

function RecommendationCell({ item }: { item: SupportCaseSummary }) {
  if (!item.escalationRecommendation) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <span className="break-words text-slate-900">
      {formatRecommendationLabel(item.escalationRecommendation)}
    </span>
  );
}

/** Dashboard Reported column: calendar date only. Full timestamp stays in case views. */
function ReportedCell({ value }: { value: string }) {
  const parts = formatDateTimeParts(value);
  if (!parts) {
    return <span className="text-slate-600">—</span>;
  }

  return (
    <time
      dateTime={value}
      className="block whitespace-nowrap text-slate-600"
    >
      {parts.date}
    </time>
  );
}

const reportedColClass = "pl-4 pr-4 py-2.5 sm:pl-5 sm:pr-5";
const reportedCellClass = "pl-4 pr-4 py-3 sm:pl-5 sm:pr-5";
const midColClass = "px-3 py-2.5 sm:px-3";
const midCellClass = "px-3 py-3 sm:px-3";
const lastColClass = "pl-3 pr-4 py-2.5 sm:pl-3 sm:pr-5";
const lastCellClass = "pl-3 pr-4 py-3 sm:pl-3 sm:pr-5";

export function CaseListTable({ cases }: CaseListTableProps) {
  if (cases.length === 0) {
    return (
      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <div className="flex flex-col items-start gap-3 px-4 py-12">
          <div>
            <p className="text-sm font-medium text-slate-900">No cases yet</p>
            <p className="mt-1 max-w-md text-sm text-slate-600">
              Create a support case to capture customer-provided evidence and
              begin the escalation review workflow.
            </p>
          </div>
          <Link
            href="/cases/new"
            className="inline-flex items-center rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create first case
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-slate-200 bg-white">
      {/*
        Scroll the table without overflow-hidden on the card so the first
        column is never clipped by the rounded border edge.
      */}
      <div className="overflow-x-auto overscroll-x-contain">
        {/*
          Order: Reported → Customer → Severity → Issue → Product →
          Environment → Status → Recommendation.
          Reported is compact (date only). Freed width goes to Issue and
          Recommendation.
        */}
        <table className="w-full min-w-[78rem] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[7.5rem]" />
            <col className="w-[14%]" />
            <col className="w-[6%]" />
            <col className="w-[26%]" />
            <col className="w-[13%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className={`${reportedColClass} font-medium`}>Reported</th>
              <th className={`${midColClass} font-medium`}>Customer</th>
              <th className={`${midColClass} font-medium`}>Severity</th>
              <th className={`${midColClass} font-medium`}>Issue</th>
              <th className={`${midColClass} font-medium`}>Product</th>
              <th className={`${midColClass} font-medium`}>Environment</th>
              <th className={`${midColClass} font-medium`}>Status</th>
              <th className={`${lastColClass} font-medium`}>Recommendation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cases.map((item) => {
              const customerLabel = stripDemoMarkerPrefix(item.customer);
              const issueLabel = stripDemoMarkerPrefix(item.issueTitle);

              return (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className={`${reportedCellClass} align-top`}>
                    <ReportedCell value={item.createdAt} />
                  </td>
                  <td className={`${midCellClass} align-top`}>
                    <Link
                      href={`/cases/${item.id}`}
                      className="break-words font-medium text-slate-900 hover:underline"
                    >
                      {customerLabel}
                    </Link>
                  </td>
                  <td className={`${midCellClass} align-top`}>
                    <SeverityBadge severity={item.severity} />
                  </td>
                  <td className={`${midCellClass} align-top text-slate-700`}>
                    <Link
                      href={`/cases/${item.id}`}
                      className="line-clamp-2 break-words hover:underline"
                      title={issueLabel}
                    >
                      {issueLabel}
                    </Link>
                  </td>
                  <td
                    className={`${midCellClass} align-top break-words text-slate-700`}
                  >
                    {item.product}
                  </td>
                  <td
                    className={`${midCellClass} align-top capitalize text-slate-700`}
                  >
                    {item.environment}
                  </td>
                  <td className={`${midCellClass} align-top`}>
                    <StatusBadge status={item.status} />
                  </td>
                  <td className={`${lastCellClass} align-top`}>
                    <RecommendationCell item={item} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

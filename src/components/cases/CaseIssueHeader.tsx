import Link from "next/link";
import {
  EnvironmentBadge,
  SeverityBadge,
  StatusBadge,
} from "@/components/cases/StatusBadge";
import {
  isDemoCaseTitle,
  stripDemoMarkerPrefix,
} from "@/lib/demo/demo-cases";
import { formatDateTime } from "@/lib/format";
import type { CaseRecord } from "@/types";

type CaseIssueHeaderProps = {
  record: CaseRecord;
};

export function CaseIssueHeader({ record }: CaseIssueHeaderProps) {
  const isDemo = isDemoCaseTitle(record.issueTitle);

  return (
    <header className="space-y-3">
      <Link
        href="/"
        className="inline-flex text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        ← Back to cases
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="bg-transparent text-sm text-slate-500">
            <span className="text-slate-500">Customer:</span>{" "}
            <span className="text-slate-700">
              {stripDemoMarkerPrefix(record.customer)}
            </span>
            <span className="mx-1.5 text-slate-300" aria-hidden>
              ·
            </span>
            <span className="text-slate-500">Product:</span>{" "}
            <span className="text-slate-700">{record.product}</span>
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {stripDemoMarkerPrefix(record.issueTitle)}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={record.severity} />
            <EnvironmentBadge environment={record.environment} />
            <StatusBadge status={record.status} />
          </div>
          {isDemo ? (
            <p className="text-xs text-slate-500">
              <span className="font-medium text-slate-600">Demo case</span>
              <span className="text-slate-400"> · </span>
              <span>Fictional data</span>
            </p>
          ) : null}
        </div>

        <dl className="shrink-0 space-y-1 text-left text-xs text-slate-500 sm:pt-1 sm:text-right">
          <div>
            <dt className="inline text-slate-400">Reported </dt>
            <dd className="inline text-slate-700">
              {formatDateTime(record.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="inline text-slate-400">Updated </dt>
            <dd className="inline text-slate-700">
              {formatDateTime(record.updatedAt)}
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}

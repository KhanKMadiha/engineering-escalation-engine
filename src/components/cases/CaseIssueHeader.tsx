import Link from "next/link";
import {
  EnvironmentBadge,
  SeverityBadge,
  StatusBadge,
} from "@/components/cases/StatusBadge";
import { stripDemoMarkerPrefix } from "@/lib/demo/demo-cases";
import type { CaseRecord } from "@/types";

type CaseIssueHeaderProps = {
  record: CaseRecord;
};

/**
 * Case detail header — issue title and status badges only.
 * Customer, product, case ID and timestamps live in Case Details.
 */
export function CaseIssueHeader({ record }: CaseIssueHeaderProps) {
  return (
    <header className="space-y-4 border-b border-border pb-5">
      <Link
        href="/"
        className="inline-flex text-sm font-medium text-muted hover:text-foreground"
      >
        ← Back to cases
      </Link>

      <div className="min-w-0 space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {stripDemoMarkerPrefix(record.issueTitle)}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={record.severity} />
          <EnvironmentBadge environment={record.environment} />
          <StatusBadge status={record.status} />
        </div>
      </div>
    </header>
  );
}

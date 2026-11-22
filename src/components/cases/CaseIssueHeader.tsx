import Link from "next/link";
import {
  EnvironmentBadge,
  SeverityBadge,
  StatusBadge,
} from "@/components/cases/StatusBadge";
import { stripDemoMarkerPrefix } from "@/lib/demo/demo-cases";
import { demoCaseOwnershipLabel } from "@/lib/ui/demo-case-labels";
import type { CaseRecord, DemoDownstreamDestination } from "@/types";

type CaseIssueHeaderProps = {
  record: CaseRecord;
  /** Optional simulated destination records for clearer post-approval labels. */
  downstreamDestinations?: ReadonlyArray<DemoDownstreamDestination> | null;
};

/**
 * Case detail header — issue title and status badges only.
 * Customer, product, case ID and timestamps live in Case Details.
 */
export function CaseIssueHeader({
  record,
  downstreamDestinations = [],
}: CaseIssueHeaderProps) {
  const ownership = demoCaseOwnershipLabel(record);

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
          {ownership ? (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium text-muted ring-1 ring-inset ring-border">
              {ownership}
            </span>
          ) : null}
          <SeverityBadge severity={record.severity} />
          <EnvironmentBadge environment={record.environment} />
          <StatusBadge
            status={record.status}
            recommendation={record.escalationResult?.recommendation}
            downstreamDestinations={downstreamDestinations}
          />
        </div>
      </div>
    </header>
  );
}

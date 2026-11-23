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
  // Shared templates rely on the global DEMO notice — omit redundant
  // "Example case". Keep "Your copy" so visitors can tell private forks apart.
  const ownership = demoCaseOwnershipLabel(record);
  const ownershipBadge = ownership === "Your copy" ? ownership : null;

  return (
    <header className="space-y-2.5 border-b border-border pb-4 sm:space-y-3 sm:pb-5">
      <Link
        href="/"
        className="inline-flex min-h-9 items-center text-sm font-medium text-muted outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
      >
        ← Back to cases
      </Link>

      <div className="min-w-0 space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
          {stripDemoMarkerPrefix(record.issueTitle)}
        </h1>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {ownershipBadge ? (
            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-muted ring-1 ring-inset ring-border">
              {ownershipBadge}
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

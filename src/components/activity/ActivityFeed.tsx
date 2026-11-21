import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format";
import {
  auditEventDetail,
  auditEventDisplayLabel,
} from "@/lib/ui/audit-event-display";
import { formatCaseKey } from "@/lib/ui/case-display";
import type { ActivityFeedItem } from "@/lib/ui/activity-feed";

type ActivityFeedProps = {
  items: ActivityFeedItem[];
};

/**
 * Cross-case activity list from persisted audit events only.
 */
export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <Card padding="lg">
        <h2 className="text-base font-semibold text-foreground">No activity yet</h2>
        <p className="mt-1.5 text-[15px] text-muted">
          Audit events from case intake, analysis, decisions and handoffs will
          appear here as cases progress.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <ul className="divide-y divide-border" role="list">
        {items.map((item) => {
          const detail = auditEventDetail(item.event);
          return (
            <li key={`${item.caseId}-${item.event.id}`}>
              <Link
                href={`/cases/${item.caseId}`}
                className="block px-5 py-4 outline-none transition-colors hover:bg-subtle/60 focus-visible:bg-subtle/60"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[15px] font-medium text-foreground">
                    {auditEventDisplayLabel(item.event)}
                  </p>
                  <time
                    dateTime={item.event.createdAt}
                    className="shrink-0 text-sm text-muted"
                  >
                    {formatDateTime(item.event.createdAt)}
                  </time>
                </div>
                {detail ? (
                  <p className="mt-0.5 text-sm text-muted">{detail}</p>
                ) : null}
                <p className="mt-1.5 text-sm text-muted">
                  <span className="font-mono text-xs font-medium text-foreground">
                    {formatCaseKey(item.caseId)}
                  </span>
                  <span className="mx-1.5 text-border" aria-hidden>
                    ·
                  </span>
                  <span className="font-medium text-foreground">
                    {item.caseTitle}
                  </span>
                  <span className="mx-1.5 text-border" aria-hidden>
                    ·
                  </span>
                  {item.customer}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

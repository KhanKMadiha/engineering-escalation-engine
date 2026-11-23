import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  FileText,
  Layers,
  Paperclip,
  RefreshCw,
} from "lucide-react";
import { AppIcon } from "@/components/ui/AppIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";
import {
  auditEventDetail,
  auditEventDisplayLabel,
} from "@/lib/ui/audit-event-display";
import { formatCaseKey } from "@/lib/ui/case-display";
import type { ActivityFeedItem } from "@/lib/ui/activity-feed";
import type { CaseEventType } from "@/types";

type ActivityFeedProps = {
  items: ActivityFeedItem[];
};

const EVENT_ICONS: Partial<Record<CaseEventType, LucideIcon>> = {
  case_created: ClipboardList,
  case_submitted: ClipboardList,
  ticket_imported: ClipboardList,
  analysis_started: BarChart3,
  analysis_completed: BarChart3,
  analysis_failed: BarChart3,
  escalation_evaluated: BarChart3,
  escalation_evaluation_failed: BarChart3,
  human_decision_recorded: CheckCircle2,
  decision_recorded: CheckCircle2,
  engineering_handoff_created: Layers,
  status_changed: RefreshCw,
  technical_evidence_added: FileText,
  technical_evidence_updated: FileText,
  technical_evidence_deleted: FileText,
  technical_evidence_attachment_added: Paperclip,
  technical_evidence_attachment_deleted: Paperclip,
};

type DayGroup = {
  label: string;
  items: ActivityFeedItem[];
};

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Groups persisted events into Today vs Earlier for chronological scanning.
 * Labels only; does not invent or drop events.
 */
function groupActivityByDay(
  items: ActivityFeedItem[],
  now = new Date(),
): DayGroup[] {
  const todayStart = startOfLocalDay(now);
  const today: ActivityFeedItem[] = [];
  const earlier: ActivityFeedItem[] = [];

  for (const item of items) {
    const parsed = Date.parse(item.event.createdAt);
    if (!Number.isNaN(parsed) && startOfLocalDay(new Date(parsed)) === todayStart) {
      today.push(item);
    } else {
      earlier.push(item);
    }
  }

  const groups: DayGroup[] = [];
  if (today.length > 0) {
    groups.push({ label: "Today", items: today });
  }
  if (earlier.length > 0) {
    groups.push({ label: "Earlier", items: earlier });
  }
  return groups;
}

function eventIcon(eventType: CaseEventType): LucideIcon {
  return EVENT_ICONS[eventType] ?? CircleDot;
}

/**
 * Cross-case activity list from persisted audit events only.
 */
export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Case updates, decisions and handoffs will appear here as work progresses."
      />
    );
  }

  const groups = groupActivityByDay(items);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.label} aria-labelledby={`activity-${group.label}`}>
          <h2
            id={`activity-${group.label}`}
            className="text-[11px] font-semibold uppercase tracking-wider text-muted"
          >
            {group.label}
          </h2>
          <ul className="mt-3 divide-y divide-border border-t border-border" role="list">
            {group.items.map((item) => {
              const detail = auditEventDetail(item.event);
              const Icon = eventIcon(item.event.eventType);
              const caseKey = formatCaseKey(item.caseId);

              return (
                <li key={`${item.caseId}-${item.event.id}`}>
                  <div className="flex gap-3 py-4 sm:gap-4">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent ring-1 ring-[#d5ebe5]">
                      <AppIcon icon={Icon} size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
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
                      <p className="mt-1 text-sm text-muted">
                        <span className="font-medium text-foreground">
                          {item.customer}
                        </span>
                        <span className="mx-1.5 text-border" aria-hidden>
                          ·
                        </span>
                        <span className="font-mono text-xs font-medium text-foreground">
                          {caseKey}
                        </span>
                      </p>
                      <Link
                        href={`/cases/${item.caseId}`}
                        className="mt-2 inline-flex text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                      >
                        View case →
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

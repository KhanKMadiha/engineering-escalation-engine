"use client";

import { useState } from "react";
import { Disclosure } from "@/components/ui/Disclosure";
import {
  auditEventDetail,
  auditEventDisplayLabel,
  formatAuditTime,
} from "@/lib/ui/audit-event-display";
import { formatDateTime } from "@/lib/format";
import type { CaseEvent } from "@/types";

type CaseTimelineProps = {
  events: CaseEvent[];
};

const PREVIEW_COUNT = 3;

/**
 * Overview sidebar recent activity — latest audit events, then full timeline.
 * Presentation only; does not invent or mutate events.
 */
export function CaseTimeline({ events }: CaseTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const orderedNewestFirst = [...events].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const orderedOldestFirst = [...orderedNewestFirst].reverse();
  const preview = orderedNewestFirst.slice(0, PREVIEW_COUNT);
  const count = orderedNewestFirst.length;

  return (
    <aside className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Recent activity
        </h2>
        {count > 0 ? (
          <p className="text-xs tabular-nums text-muted">
            {count} event{count === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      {count === 0 ? (
        <p className="mt-3 text-sm text-muted">No recorded events yet.</p>
      ) : !expanded ? (
        <div className="mt-4">
          <ol className="space-y-0">
            {preview.map((event, index) => (
              <ActivityRow
                key={event.id}
                event={event}
                isLatest={index === 0}
              />
            ))}
          </ol>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-4 text-sm font-medium text-accent hover:text-accent-hover hover:underline"
          >
            View full timeline →
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <ol className="space-y-0">
            {orderedOldestFirst.map((event, index) => (
              <ActivityRow
                key={event.id}
                event={event}
                isLatest={index === orderedOldestFirst.length - 1}
              />
            ))}
          </ol>

          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="mt-4 text-sm font-medium text-accent hover:text-accent-hover hover:underline"
          >
            Collapse timeline ↑
          </button>

          <div className="mt-3">
            <Disclosure summary="View technical audit data" variant="link">
              <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                {orderedOldestFirst.map((event) => (
                  <li
                    key={`tech-${event.id}`}
                    className="rounded border border-border bg-subtle px-2 py-1.5"
                  >
                    <p className="font-mono text-[10px] text-muted">
                      {event.eventType} · {formatDateTime(event.createdAt)}
                    </p>
                    {event.metadata &&
                    Object.keys(event.metadata).length > 0 ? (
                      <pre className="mt-1 overflow-x-auto font-mono text-[10px] leading-relaxed text-foreground">
                        {JSON.stringify(event.metadata, null, 2)}
                      </pre>
                    ) : (
                      <p className="mt-0.5 text-[10px] text-muted">
                        No metadata
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Disclosure>
          </div>
        </div>
      )}
    </aside>
  );
}

function ActivityRow({
  event,
  isLatest,
}: {
  event: CaseEvent;
  isLatest: boolean;
}) {
  const detail = auditEventDetail(event);

  return (
    <li className="relative border-l border-border pb-4 pl-4 last:pb-0">
      <span
        aria-hidden
        className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border ${
          isLatest
            ? "border-accent bg-accent"
            : "border-border bg-surface"
        }`}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug text-foreground">
            {auditEventDisplayLabel(event)}
          </p>
          {detail ? (
            <p className="mt-0.5 text-xs leading-snug text-muted">{detail}</p>
          ) : null}
        </div>
        <time
          dateTime={event.createdAt}
          className="shrink-0 font-mono text-[10px] text-muted"
          title={formatDateTime(event.createdAt)}
        >
          {formatAuditTime(event.createdAt)}
        </time>
      </div>
    </li>
  );
}

"use client";

import { useState } from "react";
import { Disclosure } from "@/components/ui/Disclosure";
import { SidebarMetaRow } from "@/components/cases/SidebarMetaRow";
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

/**
 * Overview sidebar Timeline — compact by default; expanded replaces compact.
 * Presentation only; does not invent or mutate events.
 * Placed beneath Case Details as secondary audit/history context.
 */
export function CaseTimeline({ events }: CaseTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const ordered = [...events].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const count = ordered.length;

  return (
    <aside className="mt-6 border-t border-slate-200 pt-6">
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Timeline
      </h2>

      {!expanded ? (
        <dl className="mt-3 space-y-2">
          <SidebarMetaRow label="Events">{count}</SidebarMetaRow>
          <SidebarMetaRow label="History">
            {count === 0 ? (
              <span className="text-slate-500">—</span>
            ) : (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
              >
                View timeline →
              </button>
            )}
          </SidebarMetaRow>
        </dl>
      ) : (
        <div className="mt-3">
          <dl className="mb-3 space-y-2">
            <SidebarMetaRow label="Events">{count}</SidebarMetaRow>
          </dl>
          <ol className="space-y-0">
            {ordered.map((event) => {
              const detail = auditEventDetail(event);
              return (
                <li
                  key={event.id}
                  className="relative border-l border-slate-200 pb-3 pl-3 last:pb-0"
                >
                  <span
                    aria-hidden
                    className="absolute -left-[4px] top-1.5 h-2 w-2 rounded-full border border-slate-300 bg-white"
                  />
                  <p className="text-xs leading-snug text-slate-800">
                    {auditEventDisplayLabel(event)}
                    {detail ? (
                      <span className="text-slate-500"> · {detail}</span>
                    ) : null}
                  </p>
                  <time
                    dateTime={event.createdAt}
                    className="mt-0.5 block font-mono text-[10px] text-slate-500"
                    title={formatDateTime(event.createdAt)}
                  >
                    {formatAuditTime(event.createdAt)}
                  </time>
                </li>
              );
            })}
          </ol>

          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="mt-3 text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
          >
            Collapse timeline ↑
          </button>

          <div className="mt-3">
            <Disclosure summary="View technical audit data" variant="link">
              <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                {ordered.map((event) => (
                  <li
                    key={`tech-${event.id}`}
                    className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5"
                  >
                    <p className="font-mono text-[10px] text-slate-600">
                      {event.eventType} · {formatDateTime(event.createdAt)}
                    </p>
                    {event.metadata &&
                    Object.keys(event.metadata).length > 0 ? (
                      <pre className="mt-1 overflow-x-auto font-mono text-[10px] leading-relaxed text-slate-700">
                        {JSON.stringify(event.metadata, null, 2)}
                      </pre>
                    ) : (
                      <p className="mt-0.5 text-[10px] text-slate-500">
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

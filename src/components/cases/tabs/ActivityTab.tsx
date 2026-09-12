import { Disclosure } from "@/components/ui/Disclosure";
import {
  auditEventDetail,
  auditEventLabel,
  formatAuditTime,
} from "@/lib/ui/audit-event-display";
import { formatDateTime } from "@/lib/format";
import type { CaseEvent } from "@/types";

type ActivityTabProps = {
  events: CaseEvent[];
};

/**
 * Lifecycle timeline — human-readable first; raw audit JSON on demand.
 */
export function ActivityTab({ events }: ActivityTabProps) {
  const ordered = [...events].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  return (
    <div className="max-w-3xl">
      <h2 className="text-base font-semibold text-slate-900">Activity</h2>
      <p className="mt-1 text-sm text-slate-500">
        Case lifecycle events recorded for this investigation.
      </p>

      {ordered.length === 0 ? (
        <p className="mt-6 text-sm text-slate-600">No events recorded.</p>
      ) : (
        <div className="mt-6">
          <ol className="space-y-0">
            {ordered.map((event) => {
              const detail = auditEventDetail(event);
              return (
                <li
                  key={event.id}
                  className="relative flex gap-3 border-l border-slate-200 pb-4 pl-4 last:pb-0"
                >
                  <span
                    aria-hidden
                    className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border border-slate-300 bg-white"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm text-slate-900">
                        {auditEventLabel(event.eventType)}
                        {detail ? (
                          <span className="text-slate-500"> · {detail}</span>
                        ) : null}
                      </p>
                      <time
                        dateTime={event.createdAt}
                        className="shrink-0 font-mono text-xs text-slate-500"
                        title={formatDateTime(event.createdAt)}
                      >
                        {formatAuditTime(event.createdAt)}
                      </time>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <Disclosure summary="View technical audit data" variant="link">
              <ul className="mt-3 space-y-3">
                {ordered.map((event) => (
                  <li
                    key={`tech-${event.id}`}
                    className="rounded border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <p className="font-mono text-[11px] text-slate-600">
                      {event.eventType} · {formatDateTime(event.createdAt)}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                      caseId: {event.caseId}
                    </p>
                    {event.metadata &&
                    Object.keys(event.metadata).length > 0 ? (
                      <pre className="mt-2 overflow-x-auto rounded border border-slate-200 bg-white p-2 font-mono text-[11px] leading-relaxed text-slate-700">
                        {JSON.stringify(event.metadata, null, 2)}
                      </pre>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-500">
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
    </div>
  );
}

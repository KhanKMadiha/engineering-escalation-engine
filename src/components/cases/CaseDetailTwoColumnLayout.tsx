import type { ReactNode } from "react";

/**
 * Shared case-detail desktop proportions (~72% / ~28%).
 * Use across Overview, Investigation, Escalation Assessment, and Handoff
 * so the sidebar does not shift when switching tabs.
 */
export const caseDetailTwoColumnGridClassName =
  "grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28%)]";

type CaseDetailTwoColumnLayoutProps = {
  main: ReactNode;
  sidebar: ReactNode;
  /** Optional extra classes on the main column (e.g. space-y-*). */
  mainClassName?: string;
  /** Optional extra classes on the sidebar column. */
  sidebarClassName?: string;
};

/**
 * Consistent case-detail two-column shell.
 * Desktop: main | sidebar. Below `lg`: main then sidebar stacked.
 * Presentation only — does not alter tab content or domain behaviour.
 */
export function CaseDetailTwoColumnLayout({
  main,
  sidebar,
  mainClassName = "",
  sidebarClassName = "",
}: CaseDetailTwoColumnLayoutProps) {
  return (
    <div className={caseDetailTwoColumnGridClassName}>
      <div
        className={`min-w-0 order-1 ${mainClassName}`.trim()}
      >
        {main}
      </div>
      <aside
        className={`min-w-0 order-2 overflow-x-hidden border-t border-slate-200 pt-6 lg:border-t-0 lg:pt-0 ${sidebarClassName}`.trim()}
      >
        {sidebar}
      </aside>
    </div>
  );
}

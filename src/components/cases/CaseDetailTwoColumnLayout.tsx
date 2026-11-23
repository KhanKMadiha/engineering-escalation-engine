import type { ReactNode } from "react";

/**
 * Shared case-detail desktop proportions (~70% / ~30%).
 * Use across Overview, Investigation, Escalation Assessment, and Handoff
 * so the sidebar does not shift when switching tabs.
 */
export const caseDetailTwoColumnGridClassName =
  "grid gap-5 lg:gap-6 xl:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,30%)]";

/** Assessment: wider main column so score + recommendation use available space. */
export const assessmentTwoColumnGridClassName =
  "grid gap-5 lg:gap-6 xl:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,22%)]";

type CaseDetailTwoColumnLayoutProps = {
  main: ReactNode;
  sidebar: ReactNode;
  /** Optional extra classes on the main column (e.g. space-y-*). */
  mainClassName?: string;
  /** Optional extra classes on the sidebar column. */
  sidebarClassName?: string;
  /** Optional grid class override (Assessment uses a wider main column). */
  gridClassName?: string;
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
  gridClassName = caseDetailTwoColumnGridClassName,
}: CaseDetailTwoColumnLayoutProps) {
  return (
    <div className={gridClassName}>
      <div className={`min-w-0 order-1 ${mainClassName}`.trim()}>{main}</div>
      <aside
        className={`min-w-0 order-2 overflow-x-hidden border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 xl:pl-8 ${sidebarClassName}`.trim()}
      >
        {sidebar}
      </aside>
    </div>
  );
}

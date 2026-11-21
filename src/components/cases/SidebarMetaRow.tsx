import type { ReactNode } from "react";

type SidebarMetaRowProps = {
  label: string;
  children: ReactNode;
};

/**
 * Compact label/value row for Overview right-rail metadata sections.
 * Presentation only.
 */
export function SidebarMetaRow({ label, children }: SidebarMetaRowProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 pt-0.5 text-xs font-bold text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-normal text-foreground">
        {children}
      </dd>
    </div>
  );
}

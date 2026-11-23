import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  children: ReactNode;
  className?: string;
  /** Optional trailing control aligned with the title. */
  action?: ReactNode;
};

/**
 * Section with heading + subtle divider — preferred over stacked cards for
 * Investigation and similar scan layouts. Presentation only.
 */
export function SectionCard({
  title,
  children,
  className = "",
  action,
}: SectionCardProps) {
  return (
    <section
      className={`border-b border-border pb-4 last:border-b-0 last:pb-0 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-2 text-[14px] font-normal leading-relaxed text-foreground sm:text-[15px]">
        {children}
      </div>
    </section>
  );
}

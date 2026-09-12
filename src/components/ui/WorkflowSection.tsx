import type { ReactNode } from "react";

type WorkflowSectionProps = {
  id?: string;
  title: string;
  badge?: ReactNode;
  description?: string;
  children: ReactNode;
  /** Quieter top border / spacing for secondary sections */
  subdued?: boolean;
};

/**
 * Full-width workflow section — heading + subtle divider.
 */
export function WorkflowSection({
  id,
  title,
  badge,
  description,
  children,
  subdued = false,
}: WorkflowSectionProps) {
  return (
    <section
      id={id}
      className={
        subdued
          ? "border-t border-slate-100 pt-5 mt-2"
          : "border-t border-slate-200 pt-7 mt-1"
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2
          className={
            subdued
              ? "text-sm font-medium text-slate-700"
              : "text-base font-semibold text-slate-900"
          }
        >
          {title}
        </h2>
        {badge}
      </div>
      {description ? (
        <p className="mb-4 max-w-2xl text-sm text-slate-600">{description}</p>
      ) : null}
      {children}
    </section>
  );
}

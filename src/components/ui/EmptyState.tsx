import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

/**
 * Empty list / no-data placeholder.
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[var(--radius-card)] border border-dashed border-border bg-surface px-6 py-12 shadow-[var(--shadow-card)]">
      <div>
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mt-1.5 max-w-lg text-[15px] leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

import type { ReactNode } from "react";

type PageSectionProps = {
  title: string;
  description?: string;
  /** Optional secondary notice between description and main content. */
  notice?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

export function PageSection({
  title,
  description,
  notice,
  actions,
  children,
}: PageSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm text-slate-600">{description}</p>
          ) : null}
          {notice ? <div className="pt-0.5">{notice}</div> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

import type { ReactNode } from "react";

type DisclosureProps = {
  summary: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  /** "panel" = bordered block; "link" = Jira-style text control */
  variant?: "panel" | "link";
};

/**
 * Accessible progressive disclosure using native details/summary.
 */
export function Disclosure({
  summary,
  children,
  className = "",
  defaultOpen = false,
  variant = "panel",
}: DisclosureProps) {
  if (variant === "link") {
    return (
      <details className={`group ${className}`} open={defaultOpen || undefined}>
        <summary className="cursor-pointer list-none text-sm font-medium text-sky-700 outline-none hover:text-sky-900 hover:underline focus-visible:ring-2 focus-visible:ring-sky-400 marker:content-none [&::-webkit-details-marker]:hidden">
          {summary}
        </summary>
        <div className="mt-2">{children}</div>
      </details>
    );
  }

  return (
    <details
      className={`group rounded border border-slate-200 bg-white ${className}`}
      open={defaultOpen || undefined}
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-slate-800 outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-slate-400 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block text-slate-400 transition-transform group-open:rotate-90"
          >
            ▸
          </span>
          {summary}
        </span>
      </summary>
      <div className="border-t border-slate-100 px-3 py-3">{children}</div>
    </details>
  );
}

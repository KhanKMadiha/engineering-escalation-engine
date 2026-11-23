import type { ReactNode } from "react";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-subtle text-foreground ring-border",
  accent: "bg-accent-soft text-accent ring-[#b8ddd4]",
  success: "bg-success-soft text-success ring-emerald-200",
  warning: "bg-warning-soft text-warning ring-amber-200",
  danger: "bg-danger-soft text-danger ring-red-200",
};

/**
 * Compact status/severity chip — presentation only.
 * Semantic colours only for success/warning/danger; accent for teal emphasis.
 */
export function Badge({
  children,
  tone = "neutral",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASS[tone]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}

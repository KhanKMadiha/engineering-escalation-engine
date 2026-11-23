import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { AppIcon, ICON_SIZE_KPI } from "@/components/ui/AppIcon";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  /** Small contextual Lucide icon — not decorative chrome. */
  icon?: LucideIcon;
};

/**
 * Dashboard metric card — compact value, quiet label, optional contextual icon.
 * Values must come from real case data.
 */
export function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <Card padding="sm" className="min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          {label}
        </p>
        {icon ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-accent">
            <AppIcon icon={icon} size={ICON_SIZE_KPI} />
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-[1.75rem]">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

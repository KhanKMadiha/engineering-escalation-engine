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
 * Dashboard metric card — large value, quiet label, optional contextual icon.
 * Values must come from real case data.
 */
export function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <Card padding="md" className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        {icon ? (
          <AppIcon
            icon={icon}
            size={ICON_SIZE_KPI}
            className="text-muted"
          />
        ) : null}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

import type { LucideIcon } from "lucide-react";

export const ICON_STROKE = 1.75;
export const ICON_SIZE_NAV = 18;
export const ICON_SIZE_SECTION = 20;
export const ICON_SIZE_KPI = 18;

type AppIconProps = {
  icon: LucideIcon;
  size?: number;
  className?: string;
  /** Decorative by default; set when the icon conveys meaning alone. */
  label?: string;
};

/**
 * Shared Lucide icon defaults for Support Ops — outline only, stroke 1.75.
 */
export function AppIcon({
  icon: Icon,
  size = ICON_SIZE_NAV,
  className = "",
  label,
}: AppIconProps) {
  return (
    <Icon
      size={size}
      strokeWidth={ICON_STROKE}
      absoluteStrokeWidth={false}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={`shrink-0 ${className}`.trim()}
    />
  );
}

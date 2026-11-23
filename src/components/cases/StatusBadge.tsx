import {
  displayLifecycleStatus,
  formatLifecycleStatusLabel,
} from "@/lib/ui/case-lifecycle-presentation";
import type {
  CaseStatus,
  DemoDownstreamDestination,
  Environment,
  EscalationRecommendation,
  Severity,
} from "@/types";

/** Quiet neutrals; escalated / analyzing use semantic colour for attention. */
const STATUS_STYLES: Record<CaseStatus, string> = {
  draft: "bg-subtle text-muted ring-border",
  submitted: "bg-subtle text-foreground ring-border",
  analyzing: "bg-warning-soft text-warning ring-amber-200",
  awaiting_decision: "bg-accent-soft text-accent ring-[#b8ddd4]",
  escalated: "bg-danger-soft text-danger ring-red-200",
  investigation_continues: "bg-subtle text-foreground ring-border",
  closed: "bg-subtle text-muted ring-border",
};

const STATUS_DOT: Record<CaseStatus, string> = {
  draft: "bg-muted",
  submitted: "bg-muted",
  analyzing: "bg-warning",
  awaiting_decision: "bg-accent",
  escalated: "bg-danger",
  investigation_continues: "bg-muted",
  closed: "bg-muted",
};

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "bg-danger-soft text-danger ring-red-200",
  high: "bg-danger-soft text-danger ring-red-200",
  medium: "bg-warning-soft text-warning ring-amber-200",
  low: "bg-subtle text-muted ring-border",
};

const ENVIRONMENT_STYLES: Record<Environment, string> = {
  production: "bg-subtle text-foreground ring-border",
  staging: "bg-subtle text-muted ring-border",
  development: "bg-subtle text-muted ring-border",
  unknown: "bg-subtle text-muted ring-border",
};

type StatusBadgeProps = {
  status: CaseStatus;
  /** When set, legacy awaiting_decision + non-escalate rows display as investigation continues. */
  recommendation?: EscalationRecommendation | null;
  /** Optional simulated destination records for clearer post-approval labels. */
  downstreamDestinations?: ReadonlyArray<DemoDownstreamDestination> | null;
};

export function StatusBadge({
  status,
  recommendation,
  downstreamDestinations,
}: StatusBadgeProps) {
  const labelInput = {
    status,
    escalationRecommendation: recommendation,
    downstreamDestinations,
  };
  const label = formatLifecycleStatusLabel(labelInput);
  const styleKey = displayLifecycleStatus(labelInput);

  return (
    <span
      className={`inline-flex h-6 max-w-full items-center gap-1.5 truncate rounded-md px-2 text-[12px] font-medium capitalize leading-none ring-1 ring-inset ${STATUS_STYLES[styleKey]}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[styleKey]}`}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

type SeverityBadgeProps = {
  severity: Severity;
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-md px-2 text-[12px] font-medium capitalize leading-none ring-1 ring-inset ${SEVERITY_STYLES[severity]}`}
    >
      {severity}
    </span>
  );
}

type EnvironmentBadgeProps = {
  environment: Environment;
};

export function EnvironmentBadge({ environment }: EnvironmentBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${ENVIRONMENT_STYLES[environment]}`}
    >
      {environment}
    </span>
  );
}

import { displayLifecycleStatus } from "@/lib/ui/case-lifecycle-presentation";
import type {
  CaseStatus,
  Environment,
  EscalationRecommendation,
  Severity,
} from "@/types";

/** Cool grey neutrals; escalated uses soft danger for attention. */
const STATUS_STYLES: Record<CaseStatus, string> = {
  draft: "bg-subtle text-muted ring-border",
  submitted: "bg-subtle text-foreground ring-border",
  analyzing: "bg-warning-soft text-warning ring-amber-200",
  awaiting_decision: "bg-subtle text-foreground ring-border",
  escalated: "bg-danger-soft text-danger ring-red-200",
  investigation_continues: "bg-subtle text-foreground ring-border",
  closed: "bg-subtle text-muted ring-border",
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
};

export function StatusBadge({ status, recommendation }: StatusBadgeProps) {
  const display = displayLifecycleStatus({
    status,
    escalationRecommendation: recommendation,
  });
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STATUS_STYLES[display]}`}
    >
      {display.replaceAll("_", " ")}
    </span>
  );
}

type SeverityBadgeProps = {
  severity: Severity;
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${SEVERITY_STYLES[severity]}`}
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
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${ENVIRONMENT_STYLES[environment]}`}
    >
      {environment}
    </span>
  );
}

import type { CaseStatus, Environment, Severity } from "@/types";

const STATUS_STYLES: Record<CaseStatus, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  submitted: "bg-sky-50 text-sky-800 ring-sky-200",
  analyzing: "bg-amber-50 text-amber-900 ring-amber-200",
  awaiting_decision: "bg-violet-50 text-violet-800 ring-violet-200",
  escalated: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  investigation_continues: "bg-orange-50 text-orange-900 ring-orange-200",
  closed: "bg-slate-100 text-slate-700 ring-slate-200",
};

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "bg-red-100 text-red-800 ring-red-200",
  high: "bg-red-50 text-red-700 ring-red-200",
  medium: "bg-amber-50 text-amber-900 ring-amber-200",
  low: "bg-slate-100 text-slate-700 ring-slate-200",
};

const ENVIRONMENT_STYLES: Record<Environment, string> = {
  production: "bg-sky-50 text-sky-800 ring-sky-200",
  staging: "bg-slate-100 text-slate-700 ring-slate-200",
  development: "bg-slate-100 text-slate-700 ring-slate-200",
  unknown: "bg-slate-50 text-slate-600 ring-slate-200",
};

type StatusBadgeProps = {
  status: CaseStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {status.replaceAll("_", " ")}
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

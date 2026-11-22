"use client";

import Link from "next/link";
import {
  ChevronDown,
  CirclePlus,
  ClipboardCheck,
  Clock,
  Inbox,
  ListFilter,
  Send,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import { CaseListTable } from "@/components/cases/CaseListTable";
import { AppIcon, ICON_SIZE_NAV } from "@/components/ui/AppIcon";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { buildCaseQueueStats } from "@/lib/ui/case-queue-stats";
import {
  caseMatchesReportedRange,
  caseMatchesSearch,
  type ReportedDateRange,
} from "@/lib/ui/case-queue-filters";
import { formatRecommendationLabel } from "@/lib/ui/case-display";
import type {
  CaseStatus,
  Environment,
  EscalationRecommendation,
  Severity,
  SupportCaseSummary,
} from "@/types";

type CaseQueueClientProps = {
  cases: SupportCaseSummary[];
};

type StatusFilter = "all" | CaseStatus;
type SeverityFilter = "all" | Severity;
type EnvironmentFilter = "all" | Environment;
type RecommendationFilter = "all" | EscalationRecommendation;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "awaiting_decision", label: "Awaiting approval" },
  { value: "escalated", label: "Approval recorded" },
  { value: "investigation_continues", label: "Investigation continues" },
  { value: "analyzing", label: "Analyzing" },
  { value: "submitted", label: "Submitted" },
  { value: "draft", label: "Draft" },
];

const SEVERITY_OPTIONS: { value: SeverityFilter; label: string }[] = [
  { value: "all", label: "All severities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const ENVIRONMENT_OPTIONS: { value: EnvironmentFilter; label: string }[] = [
  { value: "all", label: "All environments" },
  { value: "production", label: "Production" },
  { value: "staging", label: "Staging" },
  { value: "development", label: "Development" },
  { value: "unknown", label: "Unknown" },
];

const RECOMMENDATION_OPTIONS: {
  value: RecommendationFilter;
  label: string;
}[] = [
  { value: "all", label: "All recommendations" },
  { value: "escalate", label: formatRecommendationLabel("escalate") },
  {
    value: "continue_investigation",
    label: formatRecommendationLabel("continue_investigation"),
  },
  {
    value: "insufficient_evidence",
    label: formatRecommendationLabel("insufficient_evidence"),
  },
];

const REPORTED_OPTIONS: { value: ReportedDateRange; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 60 days" },
  { value: "90", label: "Last 90 days" },
];

const controlClass =
  "h-9 rounded-md border border-border bg-surface text-sm text-foreground outline-none transition-colors hover:border-[#d0d5dd] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1";

type SelectOption = { value: string; label: string };

function ToolbarSelect({
  id,
  label,
  value,
  onChange,
  options,
  widthClass,
  fullWidth = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  widthClass?: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={`relative ${fullWidth ? "w-full" : widthClass ?? ""}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange(event.target.value)
        }
        className={`${controlClass} ${
          fullWidth ? "w-full" : "w-full"
        } cursor-pointer appearance-none py-0 pl-3 pr-9`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <AppIcon
        icon={ChevronDown}
        size={16}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  );
}

/**
 * Case queue with compact search/filter toolbar over the server-provided list.
 * Presentation only — does not mutate cases.
 */
export function CaseQueueClient({ cases }: CaseQueueClientProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [environment, setEnvironment] = useState<EnvironmentFilter>("all");
  const [recommendation, setRecommendation] =
    useState<RecommendationFilter>("all");
  const [reportedRange, setReportedRange] =
    useState<ReportedDateRange>("all");
  const [moreOpen, setMoreOpen] = useState(false);

  const stats = useMemo(() => buildCaseQueueStats(cases), [cases]);

  const filtered = useMemo(() => {
    return cases.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (severity !== "all" && item.severity !== severity) return false;
      if (environment !== "all" && item.environment !== environment) {
        return false;
      }
      if (
        recommendation !== "all" &&
        item.escalationRecommendation !== recommendation
      ) {
        return false;
      }
      if (!caseMatchesReportedRange(item.createdAt, reportedRange)) {
        return false;
      }
      return caseMatchesSearch(item, query);
    });
  }, [
    cases,
    query,
    status,
    severity,
    environment,
    recommendation,
    reportedRange,
  ]);

  const moreActiveCount = recommendation !== "all" ? 1 : 0;

  const hasActiveFilters =
    query.trim() !== "" ||
    status !== "all" ||
    severity !== "all" ||
    environment !== "all" ||
    reportedRange !== "all" ||
    recommendation !== "all";

  function resetFilters() {
    setQuery("");
    setStatus("all");
    setSeverity("all");
    setEnvironment("all");
    setReportedRange("all");
    setRecommendation("all");
    setMoreOpen(false);
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Case queue
          </h1>
          <p className="max-w-3xl text-[15px] text-muted">
            Review incoming cases, track investigations and manage Engineering
            escalations.
          </p>
        </div>
        <Link href="/cases/new" className="shrink-0">
          <Button variant="primary" size="lg">
            <AppIcon
              icon={CirclePlus}
              size={ICON_SIZE_NAV}
              className="text-accent-foreground"
            />
            New case
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Awaiting review"
          value={stats.awaitingReview}
          icon={ClipboardCheck}
        />
        <StatCard
          label="Approval recorded"
          value={stats.readyForHandoff}
          icon={Send}
        />
        <StatCard label="In progress" value={stats.inProgress} icon={Clock} />
        <StatCard label="Total cases" value={cases.length} icon={Inbox} />
      </div>

      <div className="space-y-3">
        <div
          className="flex flex-wrap items-center gap-2"
          role="search"
          aria-label="Filter cases"
        >
          <label htmlFor="case-queue-search" className="sr-only">
            Search by case ID, issue or customer
          </label>
          <input
            id="case-queue-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ID or issue..."
            className={`${controlClass} w-full max-w-[15.5rem] px-3`}
          />

          <ToolbarSelect
            id="filter-status"
            label="Status"
            value={status}
            onChange={(value) => setStatus(value as StatusFilter)}
            options={STATUS_OPTIONS}
            widthClass="w-[11.5rem] shrink-0"
          />

          <ToolbarSelect
            id="filter-severity"
            label="Severity"
            value={severity}
            onChange={(value) => setSeverity(value as SeverityFilter)}
            options={SEVERITY_OPTIONS}
            widthClass="w-[9rem] shrink-0"
          />

          <ToolbarSelect
            id="filter-environment"
            label="Environment"
            value={environment}
            onChange={(value) => setEnvironment(value as EnvironmentFilter)}
            options={ENVIRONMENT_OPTIONS}
            widthClass="w-[10.5rem] shrink-0"
          />

          <ToolbarSelect
            id="filter-reported"
            label="Reported date"
            value={reportedRange}
            onChange={(value) =>
              setReportedRange(value as ReportedDateRange)
            }
            options={REPORTED_OPTIONS}
            widthClass="w-[9.5rem] shrink-0"
          />

          <MoreFiltersMenu
            open={moreOpen}
            onOpenChange={setMoreOpen}
            activeCount={moreActiveCount}
            recommendation={recommendation}
            onRecommendationChange={setRecommendation}
          />

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className={`${controlClass} inline-flex items-center gap-1.5 px-2.5 text-muted hover:bg-subtle hover:text-foreground`}
            >
              <AppIcon icon={X} size={14} className="text-muted" />
              Clear filters
            </button>
          ) : null}
        </div>

        <CaseListTable cases={filtered} />

        <p className="text-sm text-muted">
          Showing{" "}
          <span className="font-medium text-foreground">{filtered.length}</span>
          {" of "}
          <span className="font-medium text-foreground">{cases.length}</span>
          {" cases"}
        </p>
      </div>
    </div>
  );
}

function MoreFiltersMenu({
  open,
  onOpenChange,
  activeCount,
  recommendation,
  onRecommendationChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
  recommendation: RecommendationFilter;
  onRecommendationChange: (value: RecommendationFilter) => void;
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useDismissible(open, () => onOpenChange(false), rootRef);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        id={`${panelId}-trigger`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
        className={`${controlClass} inline-flex items-center gap-1.5 px-2.5 ${
          open || activeCount > 0
            ? "border-foreground/20 bg-subtle text-foreground"
            : "text-muted hover:bg-subtle hover:text-foreground"
        }`}
      >
        <AppIcon icon={ListFilter} size={16} className="text-muted" />
        More filters
        {activeCount > 0 ? (
          <span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-accent-foreground tabular-nums">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="More filters"
          aria-modal="false"
          className="absolute left-0 z-30 mt-2 w-[min(100vw-2rem,18rem)] rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:left-auto sm:right-0"
        >
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">
              Recommendation
            </p>
            <ToolbarSelect
              id="filter-recommendation"
              label="Recommendation"
              value={recommendation}
              onChange={(value) =>
                onRecommendationChange(value as RecommendationFilter)
              }
              options={RECOMMENDATION_OPTIONS}
              fullWidth
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function useDismissible(
  open: boolean,
  onDismiss: () => void,
  rootRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        onDismiss();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onDismiss, rootRef]);
}

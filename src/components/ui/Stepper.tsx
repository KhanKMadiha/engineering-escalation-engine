"use client";

import {
  useId,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  WORKFLOW_STAGES,
  isWorkflowStageAvailable,
  workflowStageIndex,
  workflowStageUnavailableReason,
  type WorkflowStage,
} from "@/lib/ui/case-workflow-stages";
import type { CaseStatus, EscalationRecommendation } from "@/types";

type StepperProps = {
  status: CaseStatus;
  recommendation?: EscalationRecommendation | null;
  /** Section currently being viewed (local UI state only). */
  selectedStage: WorkflowStage;
  onSelectStage: (stage: WorkflowStage) => void;
  /** id of the associated tabpanel for aria-controls. */
  panelId?: string;
  className?: string;
};

/**
 * Interactive workflow navigator.
 * Desktop: horizontal step list. Mobile: compact select of available stages.
 * Unavailable stages stay visible but disabled. Selection is local view state.
 */
export function CaseWorkflowStepper({
  status,
  recommendation = null,
  selectedStage,
  onSelectStage,
  panelId,
  className = "",
}: StepperProps) {
  const activeIndex = workflowStageIndex(status, recommendation);
  const stages = WORKFLOW_STAGES as readonly WorkflowStage[];
  const selectedIndex = stages.indexOf(selectedStage);
  const baseId = useId();
  const selectId = `${baseId}-mobile-select`;

  function selectIfAvailable(stage: WorkflowStage) {
    if (!isWorkflowStageAvailable(stage, status, recommendation)) {
      return;
    }
    onSelectStage(stage);
  }

  function nextAvailableIndex(from: number, direction: 1 | -1): number {
    const last = stages.length - 1;
    let index = from;
    for (let step = 0; step < stages.length; step += 1) {
      index = index + direction;
      if (index < 0) index = last;
      if (index > last) index = 0;
      const stage = stages[index];
      if (stage && isWorkflowStageAvailable(stage, status, recommendation)) {
        return index;
      }
    }
    return from;
  }

  function onStepKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let next = index;
    if (event.key === "ArrowRight") {
      next = nextAvailableIndex(index, 1);
    } else if (event.key === "ArrowLeft") {
      next = nextAvailableIndex(index, -1);
    } else if (event.key === "Home") {
      next = stages.findIndex((stage) =>
        isWorkflowStageAvailable(stage, status, recommendation),
      );
      if (next < 0) return;
    } else if (event.key === "End") {
      for (let i = stages.length - 1; i >= 0; i -= 1) {
        const stage = stages[i];
        if (stage && isWorkflowStageAvailable(stage, status, recommendation)) {
          next = i;
          break;
        }
      }
    } else {
      return;
    }
    event.preventDefault();
    const stage = stages[next];
    if (!stage) return;
    selectIfAvailable(stage);
    document.getElementById(`${baseId}-step-${stage}`)?.focus();
  }

  function onMobileSelect(event: ChangeEvent<HTMLSelectElement>) {
    selectIfAvailable(event.target.value as WorkflowStage);
  }

  return (
    <div className={`w-full ${className}`.trim()}>
      {/* Compact mobile selector — unavailable stages remain listed but disabled */}
      <div className="sm:hidden">
        <label htmlFor={selectId} className="sr-only">
          Case workflow section
        </label>
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              selectedIndex < activeIndex
                ? "bg-success text-white"
                : selectedIndex === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "bg-subtle text-foreground ring-1 ring-inset ring-border"
            }`}
          >
            {selectedIndex < activeIndex ? "✓" : String(selectedIndex + 1)}
          </span>
          <select
            id={selectId}
            value={selectedStage}
            onChange={onMobileSelect}
            aria-controls={panelId}
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          >
            {stages.map((stage) => {
              const available = isWorkflowStageAvailable(
                stage,
                status,
                recommendation,
              );
              const reason = workflowStageUnavailableReason(
                stage,
                status,
                recommendation,
              );
              return (
                <option key={stage} value={stage} disabled={!available}>
                  {available
                    ? stage
                    : `${stage} (unavailable${reason ? ` — ${reason}` : ""})`}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Desktop / tablet horizontal stepper */}
      <nav
        aria-label="Case workflow sections"
        className="hidden w-full sm:block"
      >
        <ol
          role="tablist"
          aria-orientation="horizontal"
          className="flex flex-wrap items-center gap-y-1"
        >
          {stages.map((stage, index) => {
            const complete = index < activeIndex;
            const statusCurrent = index === activeIndex;
            const selected = index === selectedIndex;
            const available = isWorkflowStageAvailable(
              stage,
              status,
              recommendation,
            );
            const unavailableReason = workflowStageUnavailableReason(
              stage,
              status,
              recommendation,
            );
            const stepNumber = String(index + 1);

            return (
              <li key={stage} className="flex items-center" role="presentation">
                {index > 0 ? (
                  <span
                    aria-hidden
                    className="mx-2 h-px w-6 bg-border md:mx-2.5 md:w-10"
                  />
                ) : null}
                <button
                  id={`${baseId}-step-${stage}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={panelId}
                  aria-current={statusCurrent ? "step" : undefined}
                  aria-disabled={!available}
                  disabled={!available}
                  title={unavailableReason ?? undefined}
                  tabIndex={selected && available ? 0 : -1}
                  onClick={() => selectIfAvailable(stage)}
                  onKeyDown={(event) => onStepKeyDown(event, index)}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                    !available
                      ? "cursor-not-allowed text-muted/70"
                      : selected
                        ? "bg-accent-soft text-foreground ring-1 ring-inset ring-[#b8ddd4]"
                        : "text-muted hover:bg-subtle/70 hover:text-foreground"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      !available
                        ? "bg-subtle text-muted/70 ring-1 ring-inset ring-border"
                        : complete
                          ? "bg-success text-white"
                          : selected
                            ? "bg-accent text-accent-foreground"
                            : statusCurrent
                              ? "bg-subtle text-foreground ring-1 ring-inset ring-border"
                              : "bg-subtle text-muted"
                    }`}
                  >
                    {complete && available ? "✓" : stepNumber}
                  </span>
                  <span>{stage}</span>
                  {statusCurrent ? (
                    <span className="sr-only"> (current case status)</span>
                  ) : null}
                  {!available && unavailableReason ? (
                    <span className="sr-only"> — {unavailableReason}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

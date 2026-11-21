"use client";

import {
  useId,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  WORKFLOW_STAGES,
  workflowStageIndex,
  type WorkflowStage,
} from "@/lib/ui/case-workflow-stages";
import type { CaseStatus } from "@/types";

type StepperProps = {
  status: CaseStatus;
  /** Section currently being viewed (local UI state only). */
  selectedStage: WorkflowStage;
  onSelectStage: (stage: WorkflowStage) => void;
  /** id of the associated tabpanel for aria-controls. */
  panelId?: string;
  className?: string;
};

/**
 * Interactive workflow navigator.
 * Desktop: horizontal step list. Mobile: compact select of all five stages.
 * Selected stage is local view state — does not mutate domain workflow.
 */
export function CaseWorkflowStepper({
  status,
  selectedStage,
  onSelectStage,
  panelId,
  className = "",
}: StepperProps) {
  const activeIndex = workflowStageIndex(status);
  const stages = WORKFLOW_STAGES as readonly WorkflowStage[];
  const selectedIndex = stages.indexOf(selectedStage);
  const baseId = useId();
  const selectId = `${baseId}-mobile-select`;

  function onStepKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const last = stages.length - 1;
    let next = index;
    if (event.key === "ArrowRight") {
      next = index === last ? 0 : index + 1;
    } else if (event.key === "ArrowLeft") {
      next = index === 0 ? last : index - 1;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = last;
    } else {
      return;
    }
    event.preventDefault();
    const stage = stages[next];
    onSelectStage(stage);
    document.getElementById(`${baseId}-step-${stage}`)?.focus();
  }

  function onMobileSelect(event: ChangeEvent<HTMLSelectElement>) {
    onSelectStage(event.target.value as WorkflowStage);
  }

  return (
    <div className={`w-full ${className}`.trim()}>
      {/* Compact mobile selector — all five stages discoverable without overflow */}
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
            {stages.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
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
                  tabIndex={selected ? 0 : -1}
                  onClick={() => onSelectStage(stage)}
                  onKeyDown={(event) => onStepKeyDown(event, index)}
                  className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                    selected
                      ? "bg-subtle text-foreground ring-1 ring-inset ring-border"
                      : "text-muted hover:bg-subtle/70 hover:text-foreground"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      complete
                        ? "bg-success text-white"
                        : selected
                          ? "bg-accent text-accent-foreground"
                          : statusCurrent
                            ? "bg-subtle text-foreground ring-1 ring-inset ring-border"
                            : "bg-subtle text-muted"
                    }`}
                  >
                    {complete ? "✓" : stepNumber}
                  </span>
                  <span>{stage}</span>
                  {statusCurrent ? (
                    <span className="sr-only"> (current case status)</span>
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

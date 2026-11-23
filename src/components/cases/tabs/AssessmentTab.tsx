"use client";

import { useId, useState } from "react";
import {
  assessmentTwoColumnGridClassName,
  CaseDetailTwoColumnLayout,
} from "@/components/cases/CaseDetailTwoColumnLayout";
import { CaseDetailsCard } from "@/components/cases/CaseDetailsCard";
import { EscalationReadinessScore } from "@/components/cases/EscalationReadinessScore";
import { recommendationTone } from "@/components/cases/EscalationAssessmentCard";
import { Button } from "@/components/ui/Button";
import {
  buildAssessmentNextAction,
  buildAssessmentRecommendationDisplay,
  recordedDecisionLabel,
} from "@/lib/ui/assessment-summary";
import { formatSignalLabel } from "@/lib/ui/case-display";
import type { WorkflowStage } from "@/lib/ui/case-workflow-stages";
import {
  continueThreshold,
  escalateThreshold,
  formatWeight,
} from "@/lib/ui/scoring-model-display";
import type { CaseRecord } from "@/types";

type AssessmentTabProps = {
  record: CaseRecord;
  goToStage: (stage: WorkflowStage) => void;
};

/**
 * Escalation Assessment — readiness score and engine recommendation as focal points.
 * Presentation only. Scoring, approval gates, and evidence storage unchanged.
 */
export function AssessmentTab({ record, goToStage }: AssessmentTabProps) {
  const { escalationResult } = record;
  const recommendation = buildAssessmentRecommendationDisplay(record);
  const nextAction = buildAssessmentNextAction(record);
  const recordedDecision = record.decision;
  const approved =
    recordedDecision?.decision === "approved" || record.status === "escalated";

  return (
    <CaseDetailTwoColumnLayout
      gridClassName={assessmentTwoColumnGridClassName}
      mainClassName="space-y-5"
      sidebarClassName="space-y-3"
      main={
        <>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Assessment
            </h2>
            <p className="text-[15px] text-muted">
              Deterministic readiness score and advisory recommendation from
              recorded case evidence.
            </p>
          </div>

          {!escalationResult || !recommendation ? (
            <p className="text-[15px] text-muted">
              Escalation has not been evaluated yet.
            </p>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-surface px-4 py-5 sm:px-5 sm:py-6">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-10">
                  <div className="min-w-0 space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Engine recommendation
                    </p>
                    <p
                      className={`inline-flex max-w-full rounded-md border px-4 py-2.5 text-lg font-semibold tracking-tight sm:text-xl ${recommendationTone(recommendation.recommendation)}`}
                    >
                      {recommendation.recommendation === "escalate" ? (
                        <span className="mr-1.5" aria-hidden>
                          ✓
                        </span>
                      ) : null}
                      {recommendation.headline}
                    </p>
                    <p className="text-[15px] leading-relaxed text-muted">
                      {recommendation.explanation}
                    </p>
                    {approved && recordedDecision ? (
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">
                          {recordedDecisionLabel(recordedDecision.decision)}.
                        </span>{" "}
                        Create escalation is available.
                      </p>
                    ) : recordedDecision ? (
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">
                          {recordedDecisionLabel(recordedDecision.decision)}.
                        </span>{" "}
                        Continue investigation; handoff is not available.
                      </p>
                    ) : (
                      <p className="text-sm text-muted">
                        Advisory recommendation. Human approval is a separate
                        stage.
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 border-t border-border pt-4 sm:pt-0 lg:border-l lg:border-t-0 lg:pl-8">
                    <EscalationReadinessScore
                      score={recommendation.score}
                      size="lg"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Next action
                    </p>
                    <p className="mt-1 text-[15px] leading-relaxed text-foreground">
                      {nextAction.summary}
                    </p>
                  </div>
                  {nextAction.showNavigation ? (
                    <Button
                      type="button"
                      variant={
                        nextAction.tone === "approved" ? "primary" : "secondary"
                      }
                      className="shrink-0"
                      onClick={() => goToStage(nextAction.targetStage)}
                    >
                      {nextAction.actionLabel} →
                    </Button>
                  ) : null}
                </div>
              </div>

              <AssessmentDetailsDisclosure record={record} />
            </>
          )}
        </>
      }
      sidebar={<CaseDetailsCard record={record} />}
    />
  );
}

function AssessmentDetailsDisclosure({ record }: { record: CaseRecord }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        className="min-h-9 text-sm font-medium text-accent outline-none hover:text-accent-hover hover:underline focus-visible:ring-2 focus-visible:ring-accent"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide assessment details" : "View assessment details"}
      </button>
      {open ? (
        <div id={panelId}>
          <AssessmentDetailsPanel record={record} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Plain-language scoring factors for Support readers.
 * Does not invent factors or duplicate Investigation content.
 */
function AssessmentDetailsPanel({ record }: { record: CaseRecord }) {
  const result = record.escalationResult;
  if (!result) {
    return null;
  }

  const factors = [...result.contributingFactors]
    .filter((factor) => factor.weight !== 0)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  return (
    <div className="mt-2.5 max-w-3xl space-y-4 border-t border-border pt-3.5 text-[14px] text-foreground">
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          What contributed to this score
        </h4>
        {factors.length === 0 ? (
          <p className="mt-2 text-muted">No scored factors recorded.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {factors.map((factor) => (
              <li
                key={`${factor.signal}-${factor.reason}`}
                className="flex flex-wrap items-baseline justify-between gap-2"
              >
                <span>{formatSignalLabel(factor.signal)}</span>
                <span className="font-mono text-sm text-muted">
                  {formatWeight(factor.weight)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          How readiness is scored
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Cases start at 0. Points are added or subtracted when recorded case
          signals match predefined Support escalation rules. Escalate at{" "}
          {escalateThreshold()} or above; continue investigation below{" "}
          {continueThreshold()}. Current score: {result.escalationScore} / 100.
        </p>
      </div>
    </div>
  );
}

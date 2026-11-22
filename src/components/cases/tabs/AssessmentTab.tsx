"use client";

import { useId, useState } from "react";
import { CaseDetailTwoColumnLayout } from "@/components/cases/CaseDetailTwoColumnLayout";
import { CaseDetailsCard } from "@/components/cases/CaseDetailsCard";
import { EscalationReadinessScore } from "@/components/cases/EscalationReadinessScore";
import { recommendationTone } from "@/components/cases/EscalationAssessmentCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
 * Escalation Assessment — one primary recommendation card.
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
      mainClassName="space-y-3"
      sidebarClassName="space-y-4"
      main={
        <>
          {!escalationResult || !recommendation ? (
            <p className="text-[15px] text-muted">
              Escalation has not been evaluated yet.
            </p>
          ) : (
            <>
              <Card padding="md">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">
                      Engine recommendation
                    </p>
                    <div
                      className={`inline-flex max-w-full rounded-md border px-3.5 py-2 text-base font-bold tracking-tight sm:text-lg ${recommendationTone(recommendation.recommendation)}`}
                    >
                      {recommendation.recommendation === "escalate" ? (
                        <span className="mr-1.5" aria-hidden>
                          ✓
                        </span>
                      ) : null}
                      {recommendation.headline}
                    </div>
                    <p className="max-w-2xl text-[15px] leading-relaxed text-muted">
                      {recommendation.explanation}
                    </p>
                    {approved && recordedDecision ? (
                      <p className="text-xs text-foreground">
                        <span className="font-semibold">
                          {recordedDecisionLabel(recordedDecision.decision)}.
                        </span>{" "}
                        Create escalation is available.
                      </p>
                    ) : recordedDecision ? (
                      <p className="text-xs text-foreground">
                        <span className="font-semibold">
                          {recordedDecisionLabel(recordedDecision.decision)}.
                        </span>{" "}
                        Continue investigation; handoff is not available.
                      </p>
                    ) : (
                      <p className="text-xs text-muted">
                        Advisory recommendation — not an approved escalation.
                      </p>
                    )}
                  </div>
                  <EscalationReadinessScore
                    score={recommendation.score}
                    size="lg"
                  />
                </div>

                <div
                  className={`mt-5 border-t border-border/80 pt-4 ${
                    nextAction.tone === "approved"
                      ? "rounded-md border border-emerald-200/80 bg-emerald-50/40 px-3.5 py-3"
                      : ""
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    Next action
                  </p>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="min-w-0 text-[15px] leading-relaxed text-foreground">
                      {nextAction.summary}
                    </p>
                    {nextAction.showNavigation ? (
                      <Button
                        type="button"
                        variant={
                          nextAction.tone === "approved"
                            ? "primary"
                            : "secondary"
                        }
                        className="shrink-0"
                        onClick={() => goToStage(nextAction.targetStage)}
                      >
                        {nextAction.actionLabel} →
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>

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
    <div className="pt-1">
      <button
        type="button"
        className="text-sm font-medium text-accent outline-none hover:text-accent-hover hover:underline focus-visible:ring-2 focus-visible:ring-accent"
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
 * Does not duplicate Investigation content or AI narrative.
 */
function AssessmentDetailsPanel({ record }: { record: CaseRecord }) {
  const result = record.escalationResult;
  if (!result) {
    return null;
  }

  // Show all non-zero factors (increases and decreases) so the score is explainable.
  const factors = [...result.contributingFactors]
    .filter((factor) => factor.weight !== 0)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  return (
    <div className="mt-3 max-w-3xl space-y-4 rounded-lg border border-border bg-subtle/40 px-3.5 py-4 text-[14px] text-slate-800">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
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
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
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

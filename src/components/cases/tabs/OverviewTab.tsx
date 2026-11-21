import { CaseDetailsCard } from "@/components/cases/CaseDetailsCard";
import { CaseDetailTwoColumnLayout } from "@/components/cases/CaseDetailTwoColumnLayout";
import { CaseTimeline } from "@/components/cases/CaseTimeline";
import {
  AnalysisRunPrompt,
  recommendationLabel,
} from "@/components/cases/EscalationAssessmentCard";
import { EscalationReadinessScore } from "@/components/cases/EscalationReadinessScore";
import { HumanDecisionPanel } from "@/components/cases/HumanDecisionPanel";
import { HumanDecisionResultPanel } from "@/components/cases/HumanDecisionResultPanel";
import type { CaseTabId } from "@/components/cases/CaseWorkspaceTabs";
import { Card, CardHeader } from "@/components/ui/Card";
import { stripDemoDescriptionBoilerplate } from "@/lib/demo/demo-cases";
import {
  shortenText,
  troubleshootingSummaryLines,
} from "@/lib/ui/case-display";
import { buildOverviewEvidenceSummary } from "@/lib/ui/overview-evidence-summary";
import type { CaseRecord, EscalationRecommendation } from "@/types";

type OverviewTabProps = {
  record: CaseRecord;
  goToTab: (tab: CaseTabId) => void;
};

/**
 * Case Detail Overview — recommendation, next action, investigation snapshot.
 * Presentation only; scoring, approval and handoff gates unchanged.
 */
export function OverviewTab({ record, goToTab }: OverviewTabProps) {
  const awaitingDecision =
    record.status === "awaiting_decision" &&
    Boolean(record.escalationResult) &&
    !record.decision;

  const approved =
    record.decision?.decision === "approved" && Boolean(record.handoff);

  const summaryLines = troubleshootingSummaryLines(
    record.troubleshootingPerformed,
    3,
  );

  return (
    <CaseDetailTwoColumnLayout
      mainClassName="space-y-6"
      sidebarClassName="space-y-6"
      main={
        <>
          {record.escalationResult ? (
            <StatusRecommendationHero
              record={record}
              onViewAssessment={() => goToTab("assessment")}
            />
          ) : null}

          {/* When the decision form is visible, skip Next action — it would only repeat the same instruction. */}
          {record.escalationResult && !awaitingDecision ? (
            <NextActionSection
              record={record}
              onOpenTab={goToTab}
            />
          ) : null}

          {awaitingDecision && record.escalationResult ? (
            <Card padding="lg" className="border-border bg-surface">
              <HumanDecisionPanel
                caseId={record.id}
                escalationResult={record.escalationResult}
              />
            </Card>
          ) : null}

          <Card padding="lg">
            <CardHeader title="Investigation summary" />
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-medium text-muted">
                  Issue description
                </h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">
                  {shortenText(
                    stripDemoDescriptionBoilerplate(record.issueDescription),
                    280,
                  ) || "—"}
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-muted">
                    Expected behaviour
                  </h3>
                  <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
                    {record.expectedBehaviour || "—"}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted">
                    Actual behaviour
                  </h3>
                  <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
                    {record.actualBehaviour || "—"}
                  </p>
                </div>
              </div>
              {summaryLines.length > 0 ? (
                <div>
                  <h3 className="text-sm font-medium text-muted">
                    Relevant findings
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {summaryLines.map((line) => (
                      <li
                        key={line}
                        className="flex gap-2 text-[15px] text-foreground"
                      >
                        <span className="text-muted" aria-hidden>
                          •
                        </span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </Card>

          {!record.analysis &&
          (record.status === "draft" ||
            record.status === "submitted" ||
            record.status === "analyzing") ? (
            <AnalysisRunPrompt
              caseId={record.id}
              status={record.status}
              hasEscalationResult={Boolean(record.escalationResult)}
            />
          ) : null}

          {record.decision && !approved ? (
            <HumanDecisionResultPanel
              decision={record.decision}
              caseStatus={record.status}
            />
          ) : null}
        </>
      }
      sidebar={
        <>
          <CaseDetailsCard record={record} />
          <CaseTimeline events={record.events} />
        </>
      }
    />
  );
}

/** Sentence-case recommendation for Overview hierarchy (presentation only). */
function recommendationHeadline(value: EscalationRecommendation): string {
  const raw = recommendationLabel(value).toLowerCase();
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function StatusRecommendationHero({
  record,
  onViewAssessment,
}: {
  record: CaseRecord;
  onViewAssessment: () => void;
}) {
  const result = record.escalationResult!;
  const label = recommendationHeadline(result.recommendation);
  const evidence = buildOverviewEvidenceSummary(record);

  return (
    <Card padding="lg" className="border-border">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Escalation recommendation
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {result.recommendation === "escalate" ? "✓ " : null}
            {label}
          </h2>
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted">
            {evidence.recommendationExplanation}
          </p>
          <button
            type="button"
            onClick={onViewAssessment}
            className="text-sm font-medium text-accent hover:text-accent-hover hover:underline"
          >
            View full assessment →
          </button>
        </div>

        <EscalationReadinessScore score={result.escalationScore} />
      </div>
    </Card>
  );
}

function NextActionSection({
  record,
  onOpenTab,
}: {
  record: CaseRecord;
  onOpenTab: (tab: CaseTabId) => void;
}) {
  const { nextAction } = buildOverviewEvidenceSummary(record);

  return (
    <Card padding="lg" className="border-border">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Next action
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
        {nextAction.title}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-muted">
        {nextAction.summary}
      </p>
      <button
        type="button"
        onClick={() => onOpenTab(nextAction.targetTab)}
        className="mt-3 text-sm font-medium text-accent hover:text-accent-hover hover:underline"
      >
        {nextAction.actionLabel} →
      </button>
    </Card>
  );
}

import { CaseDetailsCard } from "@/components/cases/CaseDetailsCard";
import { CaseDetailTwoColumnLayout } from "@/components/cases/CaseDetailTwoColumnLayout";
import { CaseTimeline } from "@/components/cases/CaseTimeline";
import {
  AnalysisRunPrompt,
  recommendationLabel,
  recommendationTone,
} from "@/components/cases/EscalationAssessmentCard";
import { HumanDecisionPanel } from "@/components/cases/HumanDecisionPanel";
import { HumanDecisionResultPanel } from "@/components/cases/HumanDecisionResultPanel";
import type { CaseTabId } from "@/components/cases/CaseWorkspaceTabs";
import { stripDemoDescriptionBoilerplate } from "@/lib/demo/demo-cases";
import {
  formatSignalLabel,
  qualifyingFactors,
  shortenText,
  troubleshootingSummaryLines,
} from "@/lib/ui/case-display";
import type { CaseRecord } from "@/types";

type OverviewTabProps = {
  record: CaseRecord;
  goToTab: (tab: CaseTabId) => void;
};

/**
 * Operational control surface: summary, recommendation, human decision.
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
  );

  return (
    <CaseDetailTwoColumnLayout
      mainClassName="space-y-8"
      main={
        <>
          <section>
            <h2 className="text-base font-semibold text-slate-900">
              Investigation summary
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-xs font-medium text-slate-500">
                  Issue description
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-900">
                  {shortenText(
                    stripDemoDescriptionBoilerplate(record.issueDescription),
                    220,
                  ) || "—"}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-medium text-slate-500">
                    Expected behaviour
                  </h3>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-900">
                    {record.expectedBehaviour || "—"}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-slate-500">
                    Actual behaviour
                  </h3>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-900">
                    {record.actualBehaviour || "—"}
                  </p>
                </div>
              </div>
              {summaryLines.length > 0 ? (
                <ul className="space-y-1.5">
                  {summaryLines.map((line) => (
                    <li key={line} className="flex gap-2 text-sm text-slate-800">
                      <span className="text-slate-400" aria-hidden>
                        •
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                onClick={() => goToTab("investigation")}
                className="text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
              >
                View investigation →
              </button>
            </div>
          </section>

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

          {record.escalationResult ? (
            <OverviewRecommendation
              record={record}
              onViewAssessment={() => goToTab("assessment")}
            />
          ) : null}

          {awaitingDecision && record.escalationResult ? (
            <HumanDecisionPanel
              caseId={record.id}
              escalationResult={record.escalationResult}
            />
          ) : null}

          {record.decision && !approved ? (
            <HumanDecisionResultPanel
              decision={record.decision}
              caseStatus={record.status}
            />
          ) : null}

          {approved ? (
            <section className="border-t border-slate-200 pt-7">
              <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Current action
              </h2>
              <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-950">
                  ✓ Approved for escalation
                </p>
                <p className="mt-1.5 text-sm text-emerald-950/90">
                  Engineering handoff is ready. Review the handoff and create the
                  Jira escalation or Rootly incident from the Handoff tab.
                </p>
                <button
                  type="button"
                  onClick={() => goToTab("handoff")}
                  className="mt-3 text-sm font-medium text-sky-800 hover:text-sky-950 hover:underline"
                >
                  Open Handoff →
                </button>
              </div>
            </section>
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

function OverviewRecommendation({
  record,
  onViewAssessment,
}: {
  record: CaseRecord;
  onViewAssessment: () => void;
}) {
  const result = record.escalationResult!;
  const checklist = qualifyingFactors(result.contributingFactors).slice(0, 6);

  return (
    <section className="border-t border-slate-200 pt-7">
      <h2 className="text-base font-semibold text-slate-900">
        Escalation recommendation
      </h2>
      <div
        className={`mt-3 inline-flex rounded border px-3 py-2 text-sm font-semibold tracking-wide ${recommendationTone(result.recommendation)}`}
      >
        {result.recommendation === "escalate" ? "✓ " : null}
        {recommendationLabel(result.recommendation)}
      </div>

      <ul className="mt-4 space-y-1.5">
        {checklist.map((factor) => (
          <li
            key={`${factor.signal}-${factor.reason}`}
            className="flex gap-2 text-sm text-slate-800"
          >
            <span
              className={
                factor.direction === "decreases"
                  ? "text-slate-400"
                  : "text-emerald-600"
              }
              aria-hidden
            >
              {factor.direction === "decreases" ? "–" : "✓"}
            </span>
            <span>{formatSignalLabel(factor.signal)}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onViewAssessment}
        className="mt-4 text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
      >
        View escalation assessment →
      </button>
    </section>
  );
}

import { CaseDetailTwoColumnLayout } from "@/components/cases/CaseDetailTwoColumnLayout";
import { Disclosure } from "@/components/ui/Disclosure";
import { SeverityBadge } from "@/components/cases/StatusBadge";
import {
  recommendationLabel,
  recommendationTone,
} from "@/components/cases/EscalationAssessmentCard";
import {
  buildCurrentCaseCalculation,
  buildScoringModelGroups,
  continueThreshold,
  escalateThreshold,
  formatWeight,
  thresholdBands,
} from "@/lib/ui/scoring-model-display";
import { formatSignalLabel, qualifyingFactors } from "@/lib/ui/case-display";
import type { CaseRecord } from "@/types";

type AssessmentTabProps = {
  record: CaseRecord;
};

/**
 * Escalation Assessment — why this case is recommended for escalation.
 * Presentation only. Human decision remains on Overview.
 */
export function AssessmentTab({ record }: AssessmentTabProps) {
  const { analysis, escalationResult } = record;

  return (
    <CaseDetailTwoColumnLayout
      mainClassName="space-y-10"
      main={
        <>
          {!escalationResult ? (
            <p className="text-sm text-slate-600">
              Escalation has not been evaluated yet.
            </p>
          ) : (
            <>
              <RecommendationBlock result={escalationResult} />
              <SignalsConsidered result={escalationResult} />
              <TechnicalAssessment
                result={escalationResult}
                reportedSeverity={record.severity}
                aiAssessedSeverity={analysis?.aiResult.assessedSeverity}
              />
            </>
          )}
        </>
      }
      sidebar={
        <div className="space-y-8">
          <DecisionAuthorityPanel />
          <AiAnalysisSection analysis={analysis} />
        </div>
      }
    />
  );
}

function DecisionAuthorityPanel() {
  return (
    <aside>
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Decision authority
      </h2>
      <ol className="mt-3 space-y-2 text-sm">
        <li>
          <p className="font-medium text-slate-900">AI analysis</p>
          <p className="text-xs text-slate-500">Advisory</p>
        </li>
        <li className="text-slate-300" aria-hidden>
          ↓
        </li>
        <li>
          <p className="font-medium text-slate-900">Rules-based assessment</p>
          <p className="text-xs text-slate-500">Recommends</p>
        </li>
        <li className="text-slate-300" aria-hidden>
          ↓
        </li>
        <li>
          <p className="font-medium text-slate-900">Human reviewer</p>
          <p className="text-xs text-slate-500">Final decision</p>
        </li>
      </ol>
      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        AI cannot approve an escalation.
      </p>
    </aside>
  );
}

function RecommendationBlock({
  result,
}: {
  result: NonNullable<CaseRecord["escalationResult"]>;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900">
        Escalation recommendation
      </h2>
      <div
        className={`mt-3 inline-flex rounded border px-3 py-2 text-sm font-semibold tracking-wide ${recommendationTone(result.recommendation)}`}
      >
        {result.recommendation === "escalate" ? "✓ " : null}
        {recommendationLabel(result.recommendation)}
      </div>
      <p className="mt-2 text-sm text-slate-600">
        The recommendation is calculated from predefined rules and validated
        case signals. AI does not calculate the final score, and a human makes
        the final escalation decision.
      </p>
    </section>
  );
}

function SignalsConsidered({
  result,
}: {
  result: NonNullable<CaseRecord["escalationResult"]>;
}) {
  const factors = qualifyingFactors(result.contributingFactors);

  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900">
        Signals considered
      </h2>
      <ul className="mt-3 grid gap-x-10 gap-y-1.5 sm:grid-cols-2">
        {factors.map((factor) => (
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
    </section>
  );
}

function TechnicalAssessment({
  result,
  reportedSeverity,
  aiAssessedSeverity,
}: {
  result: NonNullable<CaseRecord["escalationResult"]>;
  reportedSeverity: string;
  aiAssessedSeverity?: string;
}) {
  return (
    <section className="border-t border-slate-200 pt-8">
      <h2 className="text-base font-semibold text-slate-900">
        Technical assessment
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md text-sm">
        <div>
          <dt className="text-xs text-slate-500">Score</dt>
          <dd className="mt-0.5 font-mono text-base font-semibold text-slate-900">
            {result.escalationScore} / 100
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Escalation threshold</dt>
          <dd className="mt-0.5 font-mono text-base font-semibold text-slate-900">
            {escalateThreshold()} / 100
          </dd>
        </div>
      </dl>

      <ScoreScale score={result.escalationScore} />

      <div className="mt-5">
        <Disclosure summary="How is this calculated?" variant="link">
          <ScoringExplanation
            result={result}
            reportedSeverity={reportedSeverity}
            aiAssessedSeverity={aiAssessedSeverity}
          />
        </Disclosure>
      </div>
    </section>
  );
}

function ScoreScale({ score }: { score: number }) {
  const continueAt = continueThreshold();
  const escalateAt = escalateThreshold();
  const pct = Math.min(100, Math.max(0, score));

  return (
    <div className="mt-5 max-w-xl" aria-hidden="true">
      <div className="relative h-2 rounded bg-slate-100">
        <div
          className="absolute inset-y-0 left-0 rounded bg-slate-300/80"
          style={{ width: `${continueAt}%` }}
        />
        <div
          className="absolute inset-y-0 rounded bg-amber-200/70"
          style={{
            left: `${continueAt}%`,
            width: `${escalateAt - continueAt}%`,
          }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded bg-emerald-200/70"
          style={{ left: `${escalateAt}%` }}
        />
        <span
          className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-slate-900"
          style={{ left: `calc(${pct}% - 1px)` }}
          title={`Current score ${score}`}
        />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-500">
        <span>0</span>
        <span>{continueAt}</span>
        <span>{escalateAt}</span>
        <span>100</span>
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-slate-500">
        <span>Insufficient</span>
        <span className="pl-6">Continue</span>
        <span className="pr-2">Escalate</span>
        <span />
      </div>
      <p className="mt-2 text-xs text-slate-600">
        Current score: <span className="font-mono font-medium">{score}</span>
      </p>
    </div>
  );
}

function ScoringExplanation({
  result,
  reportedSeverity,
  aiAssessedSeverity,
}: {
  result: NonNullable<CaseRecord["escalationResult"]>;
  reportedSeverity: string;
  aiAssessedSeverity?: string;
}) {
  const groups = buildScoringModelGroups({
    reportedSeverity,
    aiAssessedSeverity,
  });
  const calculation = buildCurrentCaseCalculation(result);
  const bands = thresholdBands();

  return (
    <div className="mt-3 space-y-6 text-sm text-slate-800">
      <p className="leading-relaxed text-slate-700">
        Each case starts at 0. Points are added or subtracted when the case
        meets predefined escalation rules. Signals with greater impact on
        urgency or engineering actionability carry more weight.
      </p>
      <p className="leading-relaxed text-slate-700">
        The score is an escalation-readiness score. It is not an AI confidence
        score and it is not a probability that the case is a bug.
      </p>

      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {group.title}
          </h3>
          {group.description ? (
            <p className="mt-1 text-xs text-slate-500">{group.description}</p>
          ) : null}
          <ul className="mt-2 space-y-1">
            {group.rows.map((row) => (
              <li
                key={`${group.title}-${row.label}`}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-50 py-1 last:border-0"
              >
                <span>
                  {row.label}
                  {row.isCurrent ? (
                    <span className="ml-2 text-xs font-medium text-slate-900">
                      ← This case
                    </span>
                  ) : null}
                </span>
                <span className="font-mono text-xs text-slate-600">
                  {formatWeight(row.weight)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Current case
        </h3>
        <ul className="mt-2 space-y-2">
          {calculation.lines.map((line) => (
            <li key={`${line.label}-${line.weight}-${line.explanation ?? ""}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span>{line.label}</span>
                <span className="font-mono text-xs text-slate-700">
                  {formatWeight(line.weight)}
                </span>
              </div>
              {line.explanation ? (
                <p className="mt-0.5 text-xs text-slate-500">{line.explanation}</p>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-slate-200 pt-2 font-medium">
          <span>Total</span>
          <span className="font-mono">
            {calculation.displayedScore} / 100
          </span>
        </div>
        {calculation.wasClamped ? (
          <p className="mt-2 text-xs text-slate-500">
            Raw factor total was {calculation.rawTotal}; the engine clamps scores
            to the configured 0–100 range before recommending.
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Thresholds
        </h3>
        <ul className="mt-2 space-y-3">
          {bands.map((band) => (
            <li key={band.label}>
              <p className="font-medium text-slate-900">
                {band.range} → {band.label}
              </p>
              <p className="text-xs text-slate-500">{band.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AiAnalysisSection({
  analysis,
}: {
  analysis: CaseRecord["analysis"];
}) {
  return (
    <section className="border-t border-slate-200 pt-6">
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
        AI analysis
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Advisory only — does not determine the escalation score or authorise
        escalation.
      </p>

      {!analysis ? (
        <p className="mt-4 text-sm text-slate-600">
          No AI analysis has been run for this case yet.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Assessed severity</dt>
              <dd className="mt-1">
                <SeverityBadge severity={analysis.aiResult.assessedSeverity} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Issue category</dt>
              <dd className="mt-1 capitalize text-slate-900">
                {analysis.aiResult.issueCategory}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Reproducibility</dt>
              <dd className="mt-1 capitalize text-slate-900">
                {analysis.aiResult.reproducibility.replaceAll("_", " ")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Suspected product defect</dt>
              <dd className="mt-1 text-slate-900">
                {analysis.aiResult.suspectedProductDefect ? "Yes" : "No"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Likely root cause</dt>
              <dd className="mt-1 text-slate-900">
                {analysis.aiResult.suspectedRootCause ?? "Not established"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Validated evidence</dt>
              <dd className="mt-1 text-slate-900">
                {analysis.validatedEvidence.length}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Missing evidence</dt>
              <dd className="mt-1 text-slate-900">
                {analysis.aiResult.missingEvidence.length}
              </dd>
            </div>
          </dl>

          <div className="space-y-2">
            <Disclosure summary="View AI reasoning" variant="link">
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {analysis.aiResult.reasoning}
              </p>
            </Disclosure>
            <Disclosure summary="View validated evidence" variant="link">
              {analysis.validatedEvidence.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">None retained.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {analysis.validatedEvidence.map((item, index) => (
                    <li
                      key={`${item.sourceField}-${index}`}
                      className="border-l-2 border-slate-200 pl-3"
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {item.description}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                        {item.sourceField}
                      </p>
                      <blockquote className="mt-1 font-mono text-[11px] whitespace-pre-wrap text-slate-700">
                        {item.quotedExcerpt}
                      </blockquote>
                    </li>
                  ))}
                </ul>
              )}
            </Disclosure>
          </div>
        </div>
      )}
    </section>
  );
}

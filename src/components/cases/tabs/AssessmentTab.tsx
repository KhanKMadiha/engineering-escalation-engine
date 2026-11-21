import { CaseDetailTwoColumnLayout } from "@/components/cases/CaseDetailTwoColumnLayout";
import { Disclosure } from "@/components/ui/Disclosure";
import { SeverityBadge } from "@/components/cases/StatusBadge";
import {
  recommendationLabel,
  recommendationTone,
} from "@/components/cases/EscalationAssessmentCard";
import { Card, CardHeader } from "@/components/ui/Card";
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
 * Escalation Assessment — recommendation + score as visual focal point.
 * Presentation only. Human decision remains on Overview. Scoring logic unchanged.
 */
export function AssessmentTab({ record }: AssessmentTabProps) {
  const { analysis, escalationResult } = record;

  return (
    <CaseDetailTwoColumnLayout
      mainClassName="space-y-5"
      main={
        <>
          {!escalationResult ? (
            <p className="text-[15px] text-muted">
              Escalation has not been evaluated yet.
            </p>
          ) : (
            <>
              <RecommendationHero result={escalationResult} />
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
        <div className="space-y-6">
          <DecisionAuthorityPanel />
          <AiAnalysisSection analysis={analysis} />
        </div>
      }
    />
  );
}

function DecisionAuthorityPanel() {
  return (
    <Card padding="md">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Decision authority
      </h2>
      <ol className="mt-4 space-y-3 text-[15px]">
        <li>
          <p className="font-semibold text-foreground">AI analysis</p>
          <p className="text-sm text-muted">Advisory</p>
        </li>
        <li className="text-slate-300" aria-hidden>
          ↓
        </li>
        <li>
          <p className="font-semibold text-foreground">Rules-based assessment</p>
          <p className="text-sm text-muted">Recommends</p>
        </li>
        <li className="text-slate-300" aria-hidden>
          ↓
        </li>
        <li>
          <p className="font-semibold text-foreground">Human reviewer</p>
          <p className="text-sm text-muted">Final decision</p>
        </li>
      </ol>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        AI cannot approve an escalation.
      </p>
    </Card>
  );
}

function RecommendationHero({
  result,
}: {
  result: NonNullable<CaseRecord["escalationResult"]>;
}) {
  const pct = Math.min(100, Math.max(0, result.escalationScore));

  return (
    <Card padding="lg" className="overflow-hidden border-accent/20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            Escalation recommendation
          </h2>
          <div
            className={`inline-flex rounded-lg border px-5 py-3 text-lg font-semibold tracking-wide ${recommendationTone(result.recommendation)}`}
          >
            {result.recommendation === "escalate" ? "✓ " : null}
            {recommendationLabel(result.recommendation)}
          </div>
          <p className="max-w-2xl text-[15px] text-muted">
            The recommendation is calculated from predefined rules and validated
            case signals. AI does not calculate the final score, and a human makes
            the final escalation decision.
          </p>
          <p className="text-sm font-medium text-slate-600">
            Rules-based assessment · Human approval required
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col justify-center rounded-xl border border-border bg-slate-50 px-6 py-5 lg:w-64">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Escalation readiness score
          </p>
          <p className="mt-2 font-mono text-5xl font-semibold tabular-nums leading-none text-foreground">
            {result.escalationScore}
            <span className="text-xl font-medium text-muted"> / 100</span>
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function SignalsConsidered({
  result,
}: {
  result: NonNullable<CaseRecord["escalationResult"]>;
}) {
  const factors = qualifyingFactors(result.contributingFactors);

  return (
    <Card padding="lg">
      <CardHeader
        title="Signals considered"
        description="Contributing factors from the deterministic escalation engine"
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {factors.map((factor) => (
          <li
            key={`${factor.signal}-${factor.reason}`}
            className="flex items-start justify-between gap-3 rounded-lg border border-border bg-slate-50/80 px-4 py-3 text-[15px] text-slate-800"
          >
            <span className="flex min-w-0 gap-2">
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
            </span>
            <span
              className={`shrink-0 font-mono text-sm font-semibold ${
                factor.direction === "decreases"
                  ? "text-red-700"
                  : "text-emerald-700"
              }`}
            >
              {formatWeight(factor.weight)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
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
    <Card padding="lg">
      <h2 className="text-base font-semibold text-foreground">
        Technical assessment
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:max-w-md text-[15px]">
        <div>
          <dt className="text-sm text-muted">Score</dt>
          <dd className="mt-1 font-mono text-lg font-semibold text-foreground">
            {result.escalationScore} / 100
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Escalation threshold</dt>
          <dd className="mt-1 font-mono text-lg font-semibold text-foreground">
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
    </Card>
  );
}

function ScoreScale({ score }: { score: number }) {
  const continueAt = continueThreshold();
  const escalateAt = escalateThreshold();
  const pct = Math.min(100, Math.max(0, score));

  return (
    <div className="mt-5 max-w-xl" aria-hidden="true">
      <div className="relative h-2.5 rounded bg-slate-100">
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
          className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-slate-900"
          style={{ left: `calc(${pct}% - 1px)` }}
          title={`Current score ${score}`}
        />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-muted">
        <span>0</span>
        <span>{continueAt}</span>
        <span>{escalateAt}</span>
        <span>100</span>
      </div>
      <div className="mt-0.5 flex justify-between text-[11px] text-muted">
        <span>Insufficient</span>
        <span className="pl-6">Continue</span>
        <span className="pr-2">Escalate</span>
        <span />
      </div>
      <p className="mt-2 text-sm text-muted">
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
    <div className="mt-3 space-y-6 text-[15px] text-slate-800">
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
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {group.title}
          </h3>
          {group.description ? (
            <p className="mt-1 text-sm text-muted">{group.description}</p>
          ) : null}
          <ul className="mt-2 space-y-1">
            {group.rows.map((row) => (
              <li
                key={`${group.title}-${row.label}`}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-50 py-1.5 last:border-0"
              >
                <span>
                  {row.label}
                  {row.isCurrent ? (
                    <span className="ml-2 text-sm font-medium text-foreground">
                      ← This case
                    </span>
                  ) : null}
                </span>
                <span className="font-mono text-sm text-muted">
                  {formatWeight(row.weight)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Current case
        </h3>
        <ul className="mt-2 space-y-2">
          {calculation.lines.map((line) => (
            <li key={`${line.label}-${line.weight}-${line.explanation ?? ""}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span>{line.label}</span>
                <span className="font-mono text-sm text-slate-700">
                  {formatWeight(line.weight)}
                </span>
              </div>
              {line.explanation ? (
                <p className="mt-0.5 text-sm text-muted">{line.explanation}</p>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-border pt-2 font-medium">
          <span>Total</span>
          <span className="font-mono">
            {calculation.displayedScore} / 100
          </span>
        </div>
        {calculation.wasClamped ? (
          <p className="mt-2 text-sm text-muted">
            Raw factor total was {calculation.rawTotal}; the engine clamps scores
            to the configured 0–100 range before recommending.
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Thresholds
        </h3>
        <ul className="mt-2 space-y-3">
          {bands.map((band) => (
            <li key={band.label}>
              <p className="font-medium text-foreground">
                {band.range} → {band.label}
              </p>
              <p className="text-sm text-muted">{band.description}</p>
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
    <Card padding="md">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        AI analysis
      </h2>
      <p className="mt-1 text-sm text-muted">
        Advisory only — does not determine the escalation score or authorise
        escalation.
      </p>

      {!analysis ? (
        <p className="mt-4 text-[15px] text-muted">
          No AI analysis has been run for this case yet.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <dl className="grid gap-3 text-[15px]">
            <div>
              <dt className="text-sm text-muted">Assessed severity</dt>
              <dd className="mt-1">
                <SeverityBadge severity={analysis.aiResult.assessedSeverity} />
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Issue category</dt>
              <dd className="mt-1 capitalize text-foreground">
                {analysis.aiResult.issueCategory}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Reproducibility</dt>
              <dd className="mt-1 capitalize text-foreground">
                {analysis.aiResult.reproducibility.replaceAll("_", " ")}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Suspected product defect</dt>
              <dd className="mt-1 text-foreground">
                {analysis.aiResult.suspectedProductDefect ? "Yes" : "No"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Likely root cause</dt>
              <dd className="mt-1 text-foreground">
                {analysis.aiResult.suspectedRootCause ?? "Not established"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Validated evidence</dt>
              <dd className="mt-1 text-foreground">
                {analysis.validatedEvidence.length}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Missing evidence</dt>
              <dd className="mt-1 text-foreground">
                {analysis.aiResult.missingEvidence.length}
              </dd>
            </div>
          </dl>

          <div className="space-y-2">
            <Disclosure summary="View AI reasoning" variant="link">
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
                {analysis.aiResult.reasoning}
              </p>
            </Disclosure>
            <Disclosure summary="View validated evidence" variant="link">
              {analysis.validatedEvidence.length === 0 ? (
                <p className="mt-2 text-[15px] text-muted">None retained.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {analysis.validatedEvidence.map((item, index) => (
                    <li
                      key={`${item.sourceField}-${index}`}
                      className="border-l-2 border-border pl-3"
                    >
                      <p className="text-[15px] font-medium text-foreground">
                        {item.description}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted">
                        {item.sourceField}
                      </p>
                      <blockquote className="mt-1 font-mono text-xs whitespace-pre-wrap text-slate-700">
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
    </Card>
  );
}

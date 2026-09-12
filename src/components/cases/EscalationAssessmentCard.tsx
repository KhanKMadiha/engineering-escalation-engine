import { AnalyzeCaseButton } from "@/components/cases/AnalyzeCaseButton";
import { SeverityBadge } from "@/components/cases/StatusBadge";
import { Disclosure } from "@/components/ui/Disclosure";
import { WorkflowSection } from "@/components/ui/WorkflowSection";
import { ESCALATION_THRESHOLDS } from "@/lib/escalation/escalation-rules";
import { formatSignalLabel } from "@/lib/ui/case-display";
import type {
  EscalationEngineResult,
  EscalationRecommendation,
  StoredAnalysis,
} from "@/types";

type EscalationAssessmentCardProps = {
  result: EscalationEngineResult;
  analysis?: StoredAnalysis;
};

export function recommendationLabel(value: EscalationRecommendation): string {
  return value.replaceAll("_", " ").toUpperCase();
}

export function recommendationTone(value: EscalationRecommendation): string {
  if (value === "escalate") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  if (value === "continue_investigation") {
    return "border-amber-200 bg-amber-50 text-amber-950";
  }
  return "border-slate-200 bg-slate-50 text-slate-800";
}

/**
 * Advisory AI support line — presentation only; does not affect scoring.
 * Returns null when no analysis exists.
 */
export function aiSupportCopy(
  analysis: StoredAnalysis | undefined,
  recommendation: EscalationRecommendation,
): string | null {
  if (!analysis) {
    return null;
  }
  const assessment = analysis.aiResult.aiEscalationAssessment;
  if (assessment === "likely_escalate" && recommendation === "escalate") {
    return "AI analysis supports this assessment.";
  }
  if (assessment === "likely_continue") {
    return "AI analysis suggests continued investigation.";
  }
  if (assessment === "insufficient_data") {
    return "AI analysis indicates insufficient evidence.";
  }
  return "AI analysis is available as advisory context.";
}

/**
 * Primary escalation section — deterministic recommendation first.
 * AI and score details are progressive disclosure only.
 */
export function EscalationAssessmentCard({
  result,
  analysis,
}: EscalationAssessmentCardProps) {
  const whyFactors = result.contributingFactors.filter(
    (factor) => factor.direction === "increases" && factor.weight > 0,
  );
  const checklist =
    whyFactors.length > 0
      ? whyFactors
      : result.contributingFactors.filter((f) => f.weight !== 0);

  const supportLine = aiSupportCopy(analysis, result.recommendation);

  return (
    <WorkflowSection title="Escalation assessment">
      <div
        className={`inline-flex rounded border px-3 py-2 text-sm font-semibold tracking-wide ${recommendationTone(result.recommendation)}`}
      >
        {result.recommendation === "escalate" ? "✓ " : null}
        {recommendationLabel(result.recommendation)}
      </div>
      <p className="mt-2 max-w-2xl text-xs text-slate-500">
        Deterministic rules recommendation. AI does not make this decision.
      </p>

      <div className="mt-5">
        <h3 className="text-sm font-medium text-slate-900">
          Why this case qualifies
        </h3>
        <ul className="mt-2 grid max-w-3xl gap-x-10 gap-y-1.5 sm:grid-cols-2">
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
      </div>

      {supportLine ? (
        <p className="mt-4 text-sm text-slate-600">{supportLine}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {analysis ? (
          <Disclosure summary="View AI analysis" variant="link">
            <AiAnalysisDisclosure analysis={analysis} />
          </Disclosure>
        ) : null}
        <Disclosure summary="How was this assessed?" variant="link">
          <div className="mt-2 max-w-3xl space-y-3 rounded border border-slate-100 bg-slate-50 px-3 py-3 text-xs text-slate-800">
            <p>
              The Escalation Engine applies predefined deterministic business
              rules. AI does not determine the final score or recommendation.
            </p>
            <dl className="grid grid-cols-2 gap-2 sm:max-w-md">
              <div>
                <dt className="text-slate-500">Internal score</dt>
                <dd className="font-mono text-sm font-semibold">
                  {result.escalationScore} / 100
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Recommendation</dt>
                <dd className="font-semibold">
                  {recommendationLabel(result.recommendation)}
                </dd>
              </div>
            </dl>
            <div>
              <p className="font-medium text-slate-600">Thresholds</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-700">
                <li>{ESCALATION_THRESHOLDS.escalateMin}–100 → Escalate</li>
                <li>
                  {ESCALATION_THRESHOLDS.continueMin}–
                  {ESCALATION_THRESHOLDS.escalateMin - 1} → Continue
                  investigation
                </li>
                <li>
                  0–{ESCALATION_THRESHOLDS.continueMin - 1} → Insufficient
                  evidence
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-600">
                Contributing factors
              </p>
              <ul className="mt-1.5 space-y-2">
                {result.contributingFactors.map((factor) => (
                  <li
                    key={`detail-${factor.signal}-${factor.reason}`}
                    className="rounded border border-slate-200 bg-white px-2 py-1.5"
                  >
                    <p className="font-mono text-[11px]">
                      {factor.signal}{" "}
                      <span className="text-slate-500">
                        ({factor.direction},{" "}
                        {factor.weight > 0 ? `+${factor.weight}` : factor.weight})
                      </span>
                    </p>
                    <p className="mt-0.5 text-slate-600">{factor.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Disclosure>
      </div>
    </WorkflowSection>
  );
}

function AiAnalysisDisclosure({ analysis }: { analysis: StoredAnalysis }) {
  const result = analysis.aiResult;
  const warnings = analysis.analysisWarnings ?? [];

  return (
    <div className="mt-2 max-w-3xl space-y-3 rounded border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-800">
      <p className="text-xs text-slate-500">
        Advisory AI analysis only — not an authoritative escalation decision.
      </p>
      {warnings.length > 0 ? (
        <div
          className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-950"
          role="status"
        >
          <p className="font-medium">Evidence validation warnings</p>
          <ul className="mt-1 list-disc pl-4">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <dl className="grid gap-2 sm:grid-cols-2 text-xs">
        <div>
          <dt className="text-slate-500">Assessed severity</dt>
          <dd className="mt-0.5">
            <SeverityBadge severity={result.assessedSeverity} />
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Category</dt>
          <dd className="mt-0.5 capitalize">{result.issueCategory}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Reproducibility</dt>
          <dd className="mt-0.5 capitalize">
            {result.reproducibility.replaceAll("_", " ")}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Suspected product defect</dt>
          <dd className="mt-0.5">
            {result.suspectedProductDefect ? "Yes" : "No"}
          </dd>
        </div>
      </dl>
      <div>
        <p className="text-xs font-medium text-slate-500">Likely root cause</p>
        <p className="mt-1 text-sm">
          {result.suspectedRootCause ?? "Not established"}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">Reasoning</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
          {result.reasoning}
        </p>
      </div>
      {result.missingEvidence.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-slate-500">Missing evidence</p>
          <ul className="mt-1 list-disc pl-4 text-sm">
            {result.missingEvidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <p className="text-xs font-medium text-slate-500">
          Validated evidence ({analysis.validatedEvidence.length})
        </p>
        {analysis.validatedEvidence.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">None retained.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {analysis.validatedEvidence.map((item, index) => (
              <li
                key={`${item.sourceField}-${index}`}
                className="rounded border border-slate-200 bg-white px-2.5 py-2"
              >
                <p className="text-xs font-medium">{item.description}</p>
                <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                  {item.sourceField}
                </p>
                <blockquote className="mt-1 border-l-2 border-slate-300 pl-2 font-mono text-[11px] whitespace-pre-wrap">
                  {item.quotedExcerpt}
                </blockquote>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Quiet prompt when analysis has not been run yet. */
export function AnalysisRunPrompt({
  caseId,
  status,
  hasEscalationResult,
}: {
  caseId: string;
  status: import("@/types").CaseStatus;
  hasEscalationResult: boolean;
}) {
  return (
    <WorkflowSection
      title="Analysis"
      description="Run structured AI analysis when you are ready. AI does not make the escalation decision."
      subdued
    >
      <AnalyzeCaseButton
        caseId={caseId}
        status={status}
        hasAnalysis={false}
        hasEscalationResult={hasEscalationResult}
      />
    </WorkflowSection>
  );
}

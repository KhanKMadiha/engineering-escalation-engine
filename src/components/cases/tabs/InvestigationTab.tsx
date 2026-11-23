import { CaseDetailTwoColumnLayout } from "@/components/cases/CaseDetailTwoColumnLayout";
import { TechnicalEvidenceSidebar } from "@/components/cases/TechnicalEvidenceSidebar";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  buildImpactTimeline,
  buildInvestigationNextSteps,
  buildInvestigationOverview,
  buildTroubleshootingPerformed,
  establishedWorkaround,
  reproductionResultDisplay,
  splitReproductionSteps,
  type ImpactTimelineProvenance,
  workaroundDisplayLabel,
} from "@/lib/ui/investigation-summary";
import type { CaseRecord } from "@/types";
import type { ReactNode } from "react";

type InvestigationTabProps = {
  record: CaseRecord;
};

/** Compact field label — bold for scanability; values stay regular weight. */
function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
      {children}
    </p>
  );
}

function EmptyValue({ children }: { children: ReactNode }) {
  return <p className="text-muted">{children}</p>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 font-normal">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function impactProvenanceHint(
  provenance: ImpactTimelineProvenance,
): string | null {
  // Only AI frequency needs an explicit hint so it is not read as customer-confirmed.
  return provenance === "ai_interpretation" ? "AI interpretation" : null;
}

/**
 * Investigation workspace — section headings + evidence rail.
 * Presentation only — does not alter scoring, approval, or persistence.
 * Lifecycle status lives in the case header; avoid duplicating it here.
 */
export function InvestigationTab({ record }: InvestigationTabProps) {
  const overview = buildInvestigationOverview(record);
  const impact = buildImpactTimeline(record);
  const workaround = establishedWorkaround(record);
  const workaroundLabel = workaroundDisplayLabel(workaround);
  const troubleshootingPerformed = buildTroubleshootingPerformed(
    record.troubleshootingPerformed,
  );
  const nextSteps = buildInvestigationNextSteps(record);
  const { steps } = splitReproductionSteps(record.stepsToReproduce);
  const reproductionResult = reproductionResultDisplay(
    record.stepsToReproduce,
  );

  return (
    <CaseDetailTwoColumnLayout
      mainClassName="space-y-0"
      main={
        <>
          <h2 className="mb-5 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Investigation
          </h2>

          <div className="space-y-0">
            <SectionCard title="Issue summary" className="pb-5">
              <div className="rounded-lg border border-[#d7ebe5] bg-accent-soft/70 px-3.5 py-3 sm:px-4 sm:py-3.5">
                {overview.affectedProduct ? (
                  <div className="mb-2">
                    <FieldLabel>Affected product</FieldLabel>
                    <p className="mt-0.5 text-[14px] font-medium text-foreground">
                      {overview.affectedProduct}
                    </p>
                  </div>
                ) : null}
                {overview.summary ? (
                  <p className="whitespace-pre-wrap text-[14px] font-normal leading-relaxed sm:text-[15px]">
                    {overview.summary}
                  </p>
                ) : (
                  <EmptyValue>No issue description provided.</EmptyValue>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Impact & timeline" className="pt-1 pb-5">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3 sm:gap-x-5">
                {impact.rows.map((row) => {
                  const hint = impactProvenanceHint(row.provenance);
                  return (
                    <div key={row.label} className="min-w-0 content-start">
                      <dt>
                        <FieldLabel>{row.label}</FieldLabel>
                      </dt>
                      <dd
                        className={`mt-0.5 text-[14px] font-normal leading-snug ${
                          row.provenance === "not_recorded"
                            ? "text-muted"
                            : "text-foreground"
                        }`}
                      >
                        {row.value}
                      </dd>
                      {hint ? (
                        <p className="mt-0.5 text-xs font-normal text-muted">
                          {hint}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </dl>
            </SectionCard>

            <SectionCard title="Expected vs actual behaviour" className="pt-1 pb-5">
              <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
                <div className="min-w-0">
                  <FieldLabel>Expected behaviour</FieldLabel>
                  <p className="mt-1.5 whitespace-pre-wrap text-[14px] font-normal leading-relaxed">
                    {record.expectedBehaviour.trim() || "Not provided."}
                  </p>
                </div>
                <div className="min-w-0 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                  <FieldLabel>Actual behaviour</FieldLabel>
                  <p className="mt-1.5 whitespace-pre-wrap text-[14px] font-normal leading-relaxed">
                    {record.actualBehaviour.trim() || "Not provided."}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Steps to reproduce" className="pt-1 pb-5">
              {steps.length > 0 ? (
                <ol className="space-y-2.5 text-[14px] font-normal leading-relaxed">
                  {steps.map((step, index) => (
                    <li key={step} className="flex gap-2.5">
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground"
                        aria-hidden
                      >
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyValue>No reproduction steps provided.</EmptyValue>
              )}
              {reproductionResult ? (
                <p className="mt-3 border-t border-border pt-3 text-[14px] font-normal leading-snug text-foreground">
                  <span className="font-semibold text-foreground">
                    Reproduction result:{" "}
                  </span>
                  {reproductionResult.label}
                </p>
              ) : null}
            </SectionCard>

            <SectionCard title="Troubleshooting performed">
              {troubleshootingPerformed.length > 0 ? (
                <BulletList items={troubleshootingPerformed} />
              ) : (
                <EmptyValue>No troubleshooting recorded.</EmptyValue>
              )}
            </SectionCard>

            <SectionCard title="Workaround">
              <p
                className={`font-normal ${
                  workaroundLabel.recorded ? "text-foreground" : "text-muted"
                }`}
              >
                {workaroundLabel.label}
              </p>
            </SectionCard>

            <SectionCard title="Next steps">
              {nextSteps.length > 0 ? (
                <BulletList items={nextSteps} />
              ) : (
                <EmptyValue>
                  No outstanding investigation steps listed.
                </EmptyValue>
              )}
            </SectionCard>
          </div>
        </>
      }
      sidebar={
        <TechnicalEvidenceSidebar
          caseId={record.id}
          items={record.technicalEvidence ?? []}
        />
      }
    />
  );
}

import { CaseDetailTwoColumnLayout } from "@/components/cases/CaseDetailTwoColumnLayout";
import { TechnicalEvidenceSidebar } from "@/components/cases/TechnicalEvidenceSidebar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  buildImpactTimeline,
  buildInvestigationNextSteps,
  buildInvestigationOverview,
  buildTroubleshootingPerformed,
  establishedRootCause,
  establishedWorkaround,
  investigationProgressLabel,
  reproductionResultDisplay,
  splitReproductionSteps,
  type ImpactTimelineProvenance,
} from "@/lib/ui/investigation-summary";
import type { CaseRecord } from "@/types";
import type { ReactNode } from "react";

type InvestigationTabProps = {
  record: CaseRecord;
};

/** Compact field label — bold for scanability; values stay regular weight. */
function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wide text-muted">
      {children}
    </p>
  );
}

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card padding="sm" className={className}>
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      <div className="mt-3 text-[15px] font-normal leading-relaxed text-foreground">
        {children}
      </div>
    </Card>
  );
}

function EmptyValue({ children }: { children: ReactNode }) {
  return <p className="text-muted">{children}</p>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 font-normal">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />
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
 * Investigation workspace — individual section cards matching the approved mockup.
 * Presentation only — does not alter scoring, approval, or persistence.
 */
export function InvestigationTab({ record }: InvestigationTabProps) {
  const overview = buildInvestigationOverview(record);
  const impact = buildImpactTimeline(record);
  const rootCause = establishedRootCause(record);
  const workaround = establishedWorkaround(record);
  const troubleshootingPerformed = buildTroubleshootingPerformed(
    record.troubleshootingPerformed,
  );
  const nextSteps = buildInvestigationNextSteps(record);
  const { steps } = splitReproductionSteps(record.stepsToReproduce);
  const reproductionResult = reproductionResultDisplay(
    record.stepsToReproduce,
  );
  const progress = investigationProgressLabel(record.status);

  return (
    <CaseDetailTwoColumnLayout
      mainClassName="space-y-3"
      main={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Investigation
            </h2>
            {progress ? <Badge tone="neutral">{progress}</Badge> : null}
          </div>

          <SectionCard title="Overview">
            {overview.affectedProduct ? (
              <div className="mb-3">
                <FieldLabel>Affected product</FieldLabel>
                <p className="mt-1 text-[14px] font-normal text-foreground">
                  {overview.affectedProduct}
                </p>
              </div>
            ) : null}
            {overview.summary ? (
              <p className="whitespace-pre-wrap font-normal">
                {overview.summary}
              </p>
            ) : (
              <EmptyValue>No issue description provided.</EmptyValue>
            )}
          </SectionCard>

          <SectionCard title="Impact & timeline">
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
              {impact.rows.map((row) => {
                const hint = impactProvenanceHint(row.provenance);
                return (
                  <div
                    key={row.label}
                    className="grid min-w-0 grid-rows-[auto_auto_auto] content-start gap-1"
                  >
                    <dt className="min-h-[1rem]">
                      <FieldLabel>{row.label}</FieldLabel>
                    </dt>
                    <dd
                      className={`min-h-[1.25rem] text-[14px] font-normal leading-snug ${
                        row.provenance === "not_recorded"
                          ? "text-muted"
                          : "text-foreground"
                      }`}
                    >
                      {row.value}
                    </dd>
                    <p className="min-h-[1rem] text-xs font-normal text-muted">
                      {hint ?? "\u00a0"}
                    </p>
                  </div>
                );
              })}
            </dl>
          </SectionCard>

          <SectionCard title="Expected vs actual behaviour">
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="min-w-0 rounded-md border border-border bg-slate-50/50 p-3">
                <FieldLabel>Expected behaviour</FieldLabel>
                <p className="mt-1 text-xs font-normal text-muted">
                  Customer / support-provided
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[14px] font-normal leading-relaxed">
                  {record.expectedBehaviour.trim() || "Not provided."}
                </p>
              </div>
              <div className="min-w-0 rounded-md border border-border bg-slate-50/50 p-3">
                <FieldLabel>Actual behaviour</FieldLabel>
                <p className="mt-1 text-xs font-normal text-muted">
                  Customer-reported
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[14px] font-normal leading-relaxed">
                  {record.actualBehaviour.trim() || "Not provided."}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Steps to reproduce">
            {steps.length > 0 ? (
              <ol className="list-decimal space-y-2 pl-5 text-[14px] font-normal leading-relaxed">
                {steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            ) : (
              <EmptyValue>No reproduction steps provided.</EmptyValue>
            )}
            {reproductionResult ? (
              <p className="mt-3 text-[14px] font-normal leading-snug text-foreground">
                <span className="font-bold">Reproduction result: </span>
                {reproductionResult.label}
                <span className="mt-1 block text-xs font-normal text-muted">
                  Customer / support
                </span>
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

          <div className="grid gap-3 lg:grid-cols-2">
            <SectionCard title="Root cause">
              <p
                className={`font-normal ${
                  rootCause ? "text-foreground" : "text-muted"
                }`}
              >
                {rootCause ?? "Not yet identified"}
              </p>
            </SectionCard>
            <SectionCard title="Workaround">
              <p
                className={`font-normal ${
                  workaround ? "text-foreground" : "text-muted"
                }`}
              >
                {workaround ?? "Not confirmed"}
              </p>
            </SectionCard>
          </div>

          <SectionCard title="Next steps">
            {nextSteps.length > 0 ? (
              <BulletList items={nextSteps} />
            ) : (
              <EmptyValue>
                No outstanding investigation steps listed.
              </EmptyValue>
            )}
          </SectionCard>
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

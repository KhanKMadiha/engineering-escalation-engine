import { CaseDetailTwoColumnLayout } from "@/components/cases/CaseDetailTwoColumnLayout";
import { ProvenanceBadge } from "@/components/cases/ProvenanceBadge";
import { TechnicalEvidenceSidebar } from "@/components/cases/TechnicalEvidenceSidebar";
import { stripDemoDescriptionBoilerplate } from "@/lib/demo/demo-cases";
import type { CaseRecord } from "@/types";
import type { ReactNode } from "react";

type InvestigationTabProps = {
  record: CaseRecord;
};

function Field({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-medium text-slate-500">{title}</h3>
        {trailing}
      </div>
      <div className="mt-1.5 text-sm leading-relaxed text-slate-900">
        {children}
      </div>
    </div>
  );
}

function parseLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Investigation tab — narrative main column + technical evidence sidebar.
 * Presentation/layout only; does not alter case data or workflow.
 */
export function InvestigationTab({ record }: InvestigationTabProps) {
  const steps = parseLines(record.stepsToReproduce);
  const reproducibility = record.analysis?.aiResult.reproducibility;
  const reproducibilitySource =
    record.analysis?.provenance?.reproducibility ?? "ai_inference";

  return (
    <CaseDetailTwoColumnLayout
      main={
        <>
          <h2 className="text-base font-semibold text-slate-900">
            Investigation
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            What happened, what was tested, and what was established.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Intake and investigation fields remain customer/support-provided.
            AI inference is labelled separately where shown.
          </p>

          <div className="mt-8 space-y-6">
            {reproducibility ? (
              <Field
                title="Reproducibility"
                trailing={<ProvenanceBadge source={reproducibilitySource} />}
              >
                <p className="capitalize">
                  {reproducibility.replaceAll("_", " ")}
                </p>
              </Field>
            ) : null}

            <Field title="Issue description">
              <p className="whitespace-pre-wrap">
                {stripDemoDescriptionBoilerplate(record.issueDescription) ||
                  "—"}
              </p>
            </Field>

            <Field title="Expected behaviour">
              <p className="whitespace-pre-wrap">
                {record.expectedBehaviour || "—"}
              </p>
            </Field>

            <Field title="Actual behaviour">
              <p className="whitespace-pre-wrap">
                {record.actualBehaviour || "—"}
              </p>
            </Field>

            <Field title="Steps to reproduce">
              {steps.length === 0 ? (
                <p className="text-slate-500">No reproduction steps provided.</p>
              ) : (
                <ol className="list-decimal space-y-1.5 pl-5">
                  {steps.map((step) => (
                    <li key={step}>{step.replace(/^\d+\.\s*/, "")}</li>
                  ))}
                </ol>
              )}
            </Field>

            <Field title="Troubleshooting performed">
              <pre className="whitespace-pre-wrap font-sans">
                {record.troubleshootingPerformed || "—"}
              </pre>
            </Field>
          </div>
        </>
      }
      sidebar={<TechnicalEvidenceSidebar record={record} />}
    />
  );
}

import { Disclosure } from "@/components/ui/Disclosure";
import { stripDemoDescriptionBoilerplate } from "@/lib/demo/demo-cases";
import { formatIssueFirstObserved } from "@/lib/format";
import { troubleshootingSummaryLines } from "@/lib/ui/case-display";
import type { CaseRecord } from "@/types";

type InvestigationColumnProps = {
  record: CaseRecord;
};

function parseLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Compact investigation — only decision-critical fields by default.
 * Full steps, logs, and intake metadata remain behind disclosure.
 */
export function InvestigationColumn({ record }: InvestigationColumnProps) {
  const steps = parseLines(record.stepsToReproduce);
  const summaryLines = troubleshootingSummaryLines(
    record.troubleshootingPerformed,
  );

  return (
    <section id="overview" className="min-w-0">
      <h2 className="text-base font-semibold text-slate-900">Investigation</h2>

      <div className="mt-4 space-y-5">
        <div>
          <h3 className="text-xs font-medium text-slate-500">
            Issue description
          </h3>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-900">
            {stripDemoDescriptionBoilerplate(record.issueDescription) || "—"}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-medium text-slate-500">Expected</h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-900">
              {record.expectedBehaviour || "—"}
            </p>
          </div>
          <div>
            <h3 className="text-xs font-medium text-slate-500">Actual</h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-900">
              {record.actualBehaviour || "—"}
            </p>
          </div>
        </div>

        {summaryLines.length > 0 ? (
          <ul className="space-y-1.5">
            {summaryLines.map((line) => (
              <li
                key={line}
                className="flex gap-2 text-sm text-slate-800"
              >
                <span className="text-emerald-600" aria-hidden>
                  ✓
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Disclosure summary="View reproduction steps" variant="link">
            <div className="mt-2 max-w-2xl">
              {steps.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No reproduction steps provided.
                </p>
              ) : (
                <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-slate-900">
                  {steps.map((step) => (
                    <li key={step}>{step.replace(/^\d+\.\s*/, "")}</li>
                  ))}
                </ol>
              )}
            </div>
          </Disclosure>

          <Disclosure summary="View logs & full evidence" variant="link">
            <div className="mt-2 max-w-2xl space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Troubleshooting performed
                </p>
                <pre className="mt-1 whitespace-pre-wrap font-sans text-slate-900">
                  {record.troubleshootingPerformed || "—"}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Logs / errors
                </p>
                {record.logsErrors.trim() ? (
                  <pre className="mt-1 overflow-x-auto rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[12px] leading-relaxed text-slate-800 whitespace-pre-wrap">
                    {record.logsErrors}
                  </pre>
                ) : (
                  <p className="mt-1 text-slate-500">—</p>
                )}
              </div>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Request ID</dt>
                  <dd className="font-mono text-[13px] text-slate-900">
                    {record.requestIds || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Issue first observed</dt>
                  <dd className="text-slate-900">
                    {formatIssueFirstObserved({
                      issueFirstObserved: record.issueFirstObserved,
                      incidentTimestamp: record.incidentTimestamp,
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">
                    Affected customer count
                  </dt>
                  <dd className="text-slate-900">
                    {record.affectedCustomerCount === null
                      ? "—"
                      : record.affectedCustomerCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Case ID</dt>
                  <dd className="break-all font-mono text-[11px] text-slate-800">
                    {record.id}
                  </dd>
                </div>
              </dl>
            </div>
          </Disclosure>
        </div>
      </div>
    </section>
  );
}

import { CaseDetailTwoColumnLayout } from "@/components/cases/CaseDetailTwoColumnLayout";
import { DownstreamDemoActions } from "@/components/cases/DownstreamDemoActions";
import { HandoffSummarySidebar } from "@/components/cases/HandoffSummarySidebar";
import { Disclosure } from "@/components/ui/Disclosure";
import { canCreateDownstreamDemo } from "@/lib/demo/downstream-demo";
import { stripDemoMarkersForDisplay } from "@/lib/demo/demo-cases";
import { formatDateTime } from "@/lib/format";
import { formatRecommendationLabel } from "@/lib/ui/case-display";
import type { CaseRecord, EscalationHandoff } from "@/types";
import type { ReactNode } from "react";

type HandoffTabProps = {
  record: CaseRecord;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-slate-100 py-3 last:border-b-0">
      <h3 className="text-xs font-medium text-slate-500">{title}</h3>
      <div className="mt-1.5 text-sm text-slate-900">{children}</div>
    </section>
  );
}

function PreBlock({ children }: { children: string }) {
  return (
    <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed">
      {children}
    </pre>
  );
}

/**
 * Engineering handoff workspace.
 * Approved state: actions main column + handoff/decision sidebar.
 * Presentation/layout only — does not alter handoff generation or integrations.
 */
export function HandoffTab({ record }: HandoffTabProps) {
  const approved = canCreateDownstreamDemo(record);
  const continueInvestigation =
    record.decision?.decision === "rejected" &&
    record.status === "investigation_continues";

  if (record.decision?.decision === "rejected") {
    return (
      <CaseDetailTwoColumnLayout
        main={
          <>
            <h2 className="text-base font-semibold text-slate-900">
              Engineering handoff
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-800">
              {continueInvestigation
                ? "Continue investigation"
                : "Escalation rejected"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {continueInvestigation
                ? "An engineering handoff is not available while investigation continues."
                : "Downstream actions are not available for rejected escalations."}
            </p>
          </>
        }
        sidebar={
          <aside className="min-w-0">
            <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Handoff summary
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              {continueInvestigation
                ? "Not available — investigation continues."
                : "Not available — escalation was not approved."}
            </p>
          </aside>
        }
      />
    );
  }

  if (!approved || !record.handoff) {
    return (
      <CaseDetailTwoColumnLayout
        main={
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Engineering handoff
              </h2>
              <p className="mt-2 text-sm font-medium text-slate-800">
                Awaiting human approval
              </p>
              <p className="mt-2 text-sm text-slate-600">
                An engineering handoff and downstream actions will become
                available after approval.
              </p>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-800">
                Downstream actions
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Available after approval
              </p>
            </div>
          </div>
        }
        sidebar={
          <aside className="min-w-0">
            <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Handoff summary
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Available after human approval.
            </p>
          </aside>
        }
      />
    );
  }

  return (
    <CaseDetailTwoColumnLayout
      mainClassName="space-y-10"
      main={
        <>
          <ApprovedHandoffContent handoff={record.handoff} />
          <DownstreamDemoActions handoff={record.handoff} />
        </>
      }
      sidebar={<HandoffSummarySidebar record={record} />}
    />
  );
}

function ApprovedHandoffContent({ handoff }: { handoff: EscalationHandoff }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-slate-900">
          Engineering handoff
        </h2>
        <span
          className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200"
          aria-label="Approved"
        >
          ✓ Approved
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">Ready for Engineering</p>
      <p className="mt-2 text-sm font-medium text-slate-900">
        {stripDemoMarkersForDisplay(handoff.title)}
      </p>

      <div className="mt-4">
        <Disclosure summary="View full engineering handoff" variant="link">
          <div className="mt-2">
            <Section title="Problem">
              <p className="font-medium">
                {stripDemoMarkersForDisplay(handoff.title)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">
                {stripDemoMarkersForDisplay(handoff.summary)}
              </p>
            </Section>
            <Section title="Environment">
              {handoff.environment}
              {" · "}
              Severity: {handoff.reportedSeverity}
              {handoff.affectedCustomerCount !== null
                ? ` · Affected customer count: ${handoff.affectedCustomerCount}`
                : " · Affected customer count: Not provided"}
            </Section>
            <Section title="Steps to Reproduce">
              <PreBlock>{handoff.stepsToReproduce}</PreBlock>
            </Section>
            <Section title="Expected Behaviour">
              <PreBlock>{handoff.expectedBehaviour}</PreBlock>
            </Section>
            <Section title="Actual Behaviour">
              <PreBlock>{handoff.actualBehaviour}</PreBlock>
            </Section>
            <Section title="Evidence">
              {handoff.evidence.length === 0 ? (
                <p className="text-slate-600">Evidence not available</p>
              ) : (
                <ul className="space-y-2">
                  {handoff.evidence.map((item, index) => (
                    <li
                      key={`${item.sourceField}-${index}`}
                      className="border-l-2 border-slate-200 pl-3"
                    >
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                        {item.sourceField}
                      </p>
                      <blockquote className="mt-1 font-mono text-[12px] whitespace-pre-wrap">
                        {item.quotedExcerpt}
                      </blockquote>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="Troubleshooting">
              <PreBlock>{handoff.troubleshootingPerformed}</PreBlock>
            </Section>
            <Section title="Reproducibility">
              {handoff.reproducibility.replaceAll("_", " ")}
            </Section>
            <Section title="Escalation Assessment">
              Score {handoff.escalationScore} / 100 ·{" "}
              {formatRecommendationLabel(handoff.escalationRecommendation)}
            </Section>
            <Section title="Human Decision">Approved</Section>
            <Section title="Decision Rationale">
              <p className="whitespace-pre-wrap">{handoff.decisionRationale}</p>
            </Section>
            <p className="mt-3 font-mono text-[11px] text-slate-500">
              handoffId: {handoff.id} · created:{" "}
              {formatDateTime(handoff.createdAt)}
            </p>
          </div>
        </Disclosure>
      </div>
    </div>
  );
}

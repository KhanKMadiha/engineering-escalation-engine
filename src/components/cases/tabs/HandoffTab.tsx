import { CaseDetailTwoColumnLayout } from "@/components/cases/CaseDetailTwoColumnLayout";
import { CopyHandoffButton } from "@/components/cases/CopyHandoffButton";
import { DownstreamDemoActions } from "@/components/cases/DownstreamDemoActions";
import { HandoffSummarySidebar } from "@/components/cases/HandoffSummarySidebar";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
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
    <section className="border-b border-slate-100 py-5 last:border-b-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      <div className="mt-2 text-[15px] leading-relaxed text-foreground">
        {children}
      </div>
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
 * Empty state when unavailable; structured document + actions when approved.
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
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              Engineering handoff
            </h2>
            <EmptyState
              title={
                continueInvestigation
                  ? "Continue investigation"
                  : "Escalation rejected"
              }
              description={
                continueInvestigation
                  ? "An engineering handoff is not available while investigation continues."
                  : "Downstream actions are not available for rejected escalations."
              }
            />
          </div>
        }
        sidebar={
          <aside className="min-w-0">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Handoff summary
            </h2>
            <p className="mt-3 text-[15px] text-muted">
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
          <div className="space-y-5">
            <h2 className="text-xl font-semibold text-foreground">
              Engineering handoff
            </h2>
            <EmptyState
              title="Awaiting human approval"
              description="An engineering handoff and downstream actions will become available after approval."
            />
            <Card padding="md">
              <p className="text-[15px] font-medium text-foreground">
                Downstream actions
              </p>
              <p className="mt-1 text-sm text-muted">Available after approval</p>
            </Card>
          </div>
        }
        sidebar={
          <aside className="min-w-0">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Handoff summary
            </h2>
            <p className="mt-3 text-[15px] text-muted">
              Available after human approval.
            </p>
          </aside>
        }
      />
    );
  }

  return (
    <CaseDetailTwoColumnLayout
      mainClassName="space-y-6"
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Engineering handoff
            </h2>
            <span
              className="inline-flex items-center rounded-md bg-success-soft px-2 py-0.5 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200"
              aria-label="Approved"
            >
              ✓ Approved
            </span>
          </div>
          <p className="mt-1 text-[15px] text-muted">Ready for Engineering</p>
        </div>
        <CopyHandoffButton handoff={handoff} />
      </div>

      <Card padding="lg" className="max-w-xl xl:max-w-none">
        <CardHeader title="Handoff document" />
        <Section title="Summary">
          <p className="whitespace-pre-wrap text-slate-700">
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
            <p className="text-muted">Evidence not available</p>
          ) : (
            <ul className="space-y-3">
              {handoff.evidence.map((item, index) => (
                <li
                  key={`${item.sourceField}-${index}`}
                  className="border-l-2 border-border pl-3"
                >
                  <p className="font-medium">{item.description}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">
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
        <p className="mt-4 font-mono text-[11px] text-muted">
          handoffId: {handoff.id} · created:{" "}
          {formatDateTime(handoff.createdAt)}
        </p>
      </Card>
    </div>
  );
}

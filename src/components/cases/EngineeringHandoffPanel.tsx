import { Disclosure } from "@/components/ui/Disclosure";
import { WorkflowSection } from "@/components/ui/WorkflowSection";
import { stripDemoMarkersForDisplay } from "@/lib/demo/demo-cases";
import { formatDateTime } from "@/lib/format";
import type { ReactNode } from "react";
import type { EscalationHandoff } from "@/types";

type EngineeringHandoffPanelProps = {
  handoff: EscalationHandoff;
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
 * Post-approval handoff + presentation-only Create in placeholders.
 */
export function EngineeringHandoffPanel({
  handoff,
}: EngineeringHandoffPanelProps) {
  return (
    <WorkflowSection title="Engineering handoff">
      <div className="inline-flex rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
        ✓ Escalation approved
      </div>
      <p className="mt-2 text-sm text-slate-600">Handoff package ready</p>

      <div className="mt-3">
        <Disclosure summary="View handoff" variant="link">
          <div className="mt-2 max-w-3xl">
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
                ? ` · affected customers: ${handoff.affectedCustomerCount}`
                : " · affected customers: Not provided"}
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
                      className="rounded border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                        {item.sourceField}
                      </p>
                      <blockquote className="mt-1 border-l-2 border-slate-300 pl-2 font-mono text-[12px] whitespace-pre-wrap">
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
            <Section title="Reproducibility">{handoff.reproducibility}</Section>
            <Section title="Escalation Assessment">
              Score {handoff.escalationScore} / 100 ·{" "}
              {handoff.escalationRecommendation.replaceAll("_", " ")}
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

      <div className="mt-6">
        <h3 className="text-sm font-medium text-slate-900">Create in</h3>
        <p className="mt-1 text-xs text-slate-500">
          Presentation placeholders only — integrations are not connected.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Integration not connected"
            className="cursor-not-allowed rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500"
          >
            Create Jira issue
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Integration not connected"
            className="cursor-not-allowed rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500"
          >
            Create Rootly incident
          </button>
        </div>
      </div>
    </WorkflowSection>
  );
}

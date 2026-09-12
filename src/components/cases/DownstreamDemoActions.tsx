"use client";

import { useState, type ReactNode } from "react";
import { Disclosure } from "@/components/ui/Disclosure";
import {
  createDemoJiraEscalation,
  createDemoRootlyIncident,
  type DemoJiraResult,
  type DemoRootlyResult,
} from "@/lib/demo/downstream-demo";
import type { EscalationHandoff } from "@/types";

type DownstreamDemoActionsProps = {
  handoff: EscalationHandoff;
};

/**
 * Demo-only Jira / Rootly actions after human approval.
 * State is local to this component (resets on refresh). No network I/O.
 */
export function DownstreamDemoActions({ handoff }: DownstreamDemoActionsProps) {
  const [jira, setJira] = useState<DemoJiraResult | null>(null);
  const [rootly, setRootly] = useState<DemoRootlyResult | null>(null);

  function onCreateJira() {
    setJira(createDemoJiraEscalation(handoff));
  }

  function onCreateRootly() {
    setRootly(createDemoRootlyIncident(handoff, jira?.key ?? null));
  }

  return (
    <section className="border-t border-slate-200 pt-8">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-slate-900">
          Downstream actions
        </h2>
        <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-900">
          Demo integration
        </span>
      </div>
      <p className="mt-1 max-w-2xl text-xs text-slate-500">
        Simulated only. No external systems are contacted.
      </p>

      <div className="mt-6 space-y-6">
        <JiraAction result={jira} onCreate={onCreateJira} />
        <RootlyAction result={rootly} onCreate={onCreateRootly} />
      </div>
    </section>
  );
}

function ActionRow({
  title,
  subtitle,
  description,
  action,
}: {
  title: string;
  subtitle: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
      <div className="min-w-0 max-w-xl flex-1">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {action ? <div className="shrink-0 self-start">{action}</div> : null}
    </div>
  );
}

function JiraAction({
  result,
  onCreate,
}: {
  result: DemoJiraResult | null;
  onCreate: () => void;
}) {
  return (
    <div className="border-b border-slate-100 pb-6 last:border-b-0">
      <ActionRow
        title="Jira escalation"
        subtitle="Best for engineering work / bug escalation."
        description="Create an engineering work item from the approved handoff."
        action={
          !result ? (
            <button
              type="button"
              onClick={onCreate}
              className="rounded border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Create Jira escalation
            </button>
          ) : null
        }
      />

      {result ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-emerald-900">
            ✓ Jira escalation created
          </p>
          <p className="font-mono text-sm text-slate-900">{result.key}</p>
          <dl className="grid gap-1 text-xs text-slate-600 sm:grid-cols-3">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="text-slate-800">{result.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Priority</dt>
              <dd className="text-slate-800">{result.priority}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Type</dt>
              <dd className="text-slate-800">{result.type}</dd>
            </div>
          </dl>
          <p className="text-[11px] font-medium text-amber-800">
            Simulated Jira integration · Demo only
          </p>
          <Disclosure summary="View Jira preview" variant="link">
            <JiraPreview result={result} />
          </Disclosure>
        </div>
      ) : null}
    </div>
  );
}

function RootlyAction({
  result,
  onCreate,
}: {
  result: DemoRootlyResult | null;
  onCreate: () => void;
}) {
  return (
    <div className="pb-1">
      <ActionRow
        title="Rootly incident"
        subtitle="Best for active production incidents."
        description="Create an incident for active production-impacting issues."
        action={
          !result ? (
            <button
              type="button"
              onClick={onCreate}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Create Rootly incident
            </button>
          ) : null
        }
      />

      {result ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-emerald-900">
            ✓ Rootly incident created
          </p>
          <p className="font-mono text-sm text-slate-900">{result.id}</p>
          <dl className="grid gap-1 text-xs text-slate-600 sm:grid-cols-3">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="text-slate-800">{result.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Severity</dt>
              <dd className="capitalize text-slate-800">{result.severity}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Environment</dt>
              <dd className="capitalize text-slate-800">{result.environment}</dd>
            </div>
          </dl>
          <p className="text-[11px] font-medium text-amber-800">
            Simulated Rootly integration · Demo only
          </p>
          <Disclosure summary="View Rootly preview" variant="link">
            <RootlyPreview result={result} />
          </Disclosure>
        </div>
      ) : null}
    </div>
  );
}

function PreviewField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 py-2 last:border-b-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-1 text-sm text-slate-900">{children}</div>
    </div>
  );
}

function JiraPreview({ result }: { result: DemoJiraResult }) {
  const p = result.preview;
  return (
    <div className="mt-2 max-w-2xl rounded border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="mb-2 text-[11px] font-medium text-amber-800">
        Simulated / Demo — not a real Jira issue
      </p>
      <PreviewField label="Key">{result.key}</PreviewField>
      <PreviewField label="Project">{p.project}</PreviewField>
      <PreviewField label="Issue type">{p.issueType}</PreviewField>
      <PreviewField label="Priority">{p.priority}</PreviewField>
      <PreviewField label="Summary">{p.summary}</PreviewField>
      <PreviewField label="Environment">{p.environment}</PreviewField>
      <PreviewField label="Affected customers">{p.affectedCustomers}</PreviewField>
      <PreviewField label="Reproduction">{p.reproduction}</PreviewField>
      <PreviewField label="Description">
        <pre className="whitespace-pre-wrap font-sans text-sm">{p.description}</pre>
      </PreviewField>
      <PreviewField label="Evidence">
        <ul className="list-disc space-y-1 pl-4">
          {p.evidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </PreviewField>
      <PreviewField label="Decision">{p.decision}</PreviewField>
      <PreviewField label="Decision rationale">
        <p className="whitespace-pre-wrap">{p.decisionRationale}</p>
      </PreviewField>
    </div>
  );
}

function RootlyPreview({ result }: { result: DemoRootlyResult }) {
  const p = result.preview;
  return (
    <div className="mt-2 max-w-2xl rounded border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="mb-2 text-[11px] font-medium text-amber-800">
        Simulated / Demo — not a real Rootly incident
      </p>
      <PreviewField label="Incident ID">{p.incidentId}</PreviewField>
      <PreviewField label="Status">{p.status}</PreviewField>
      <PreviewField label="Title">{p.title}</PreviewField>
      <PreviewField label="Environment">{p.environment}</PreviewField>
      <PreviewField label="Severity">
        <span className="capitalize">{p.severity}</span>
      </PreviewField>
      <PreviewField label="Affected customers">{p.affectedCustomers}</PreviewField>
      <PreviewField label="Impact">{p.impact}</PreviewField>
      <PreviewField label="Evidence">
        <ul className="list-disc space-y-1 pl-4">
          {p.evidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </PreviewField>
      <PreviewField label="Reproducibility">{p.reproducibility}</PreviewField>
      <PreviewField label="Decision rationale">
        <p className="whitespace-pre-wrap">{p.decisionRationale}</p>
      </PreviewField>
      {p.linkedEngineeringEscalation ? (
        <PreviewField label="Linked engineering escalation">
          <span className="font-mono">{p.linkedEngineeringEscalation}</span>
          <span className="ml-2 text-xs text-slate-500">
            (local demo cross-reference only)
          </span>
        </PreviewField>
      ) : null}
    </div>
  );
}

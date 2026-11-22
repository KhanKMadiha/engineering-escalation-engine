"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  createDemoDownstreamAction,
  type CreateDemoDownstreamActionState,
} from "@/actions/downstream-demo-actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import {
  createDemoJiraEscalation,
  createDemoRootlyIncident,
  selectProminentEvidence,
  type DemoJiraResult,
  type DemoRootlyResult,
} from "@/lib/demo/downstream-demo";
import { formatDateTime } from "@/lib/format";
import { stripDemoMarkersForDisplay } from "@/lib/demo/demo-cases";
import type {
  DemoDownstreamDestination,
  DemoDownstreamRecord,
  EscalationHandoff,
} from "@/types";

type Destination = DemoDownstreamDestination | null;

type DownstreamDemoActionsProps = {
  caseId: string;
  handoff: EscalationHandoff;
  product?: string | null;
  customer?: string | null;
  incidentTimestamp?: string | null;
  /** Existing workspace-scoped records for this case (survives refresh). */
  existingRecords?: DemoDownstreamRecord[];
  /** When set, wraps landing + destination buttons in one main card. */
  landing?: ReactNode;
  onPreviewChange?: (previewing: boolean) => void;
};

const initialCreateState: CreateDemoDownstreamActionState = { ok: true };

/**
 * Demo destination actions after human approval.
 * Creates persistent simulated Jira/Rootly records in the visitor workspace.
 */
export function DownstreamDemoActions({
  caseId,
  handoff,
  product,
  customer,
  incidentTimestamp,
  existingRecords = [],
  landing,
  onPreviewChange,
}: DownstreamDemoActionsProps) {
  const existingJira = existingRecords.find((r) => r.destination === "jira");
  const existingRootly = existingRecords.find(
    (r) => r.destination === "rootly",
  );

  const [destination, setDestination] = useState<Destination>(null);
  const [successRecord, setSuccessRecord] = useState<DemoDownstreamRecord | null>(
    null,
  );

  const options = { product, customer, incidentTimestamp };
  const jiraPreview =
    destination === "jira"
      ? createDemoJiraEscalation(handoff, options)
      : null;
  const rootlyPreview =
    destination === "rootly"
      ? createDemoRootlyIncident(handoff, null, options)
      : null;

  function selectDestination(next: Destination) {
    setDestination(next);
    setSuccessRecord(null);
    onPreviewChange?.(next !== null);
  }

  if (successRecord) {
    return (
      <DownstreamSuccessCard
        record={successRecord}
        customer={customer}
        onBack={() => {
          setSuccessRecord(null);
          selectDestination(null);
        }}
      />
    );
  }

  if (destination === "jira" && jiraPreview) {
    return (
      <JiraPreviewCard
        caseId={caseId}
        result={jiraPreview}
        existing={existingJira ?? null}
        onBack={() => selectDestination(null)}
        onCreated={(record) => {
          setSuccessRecord(record);
          onPreviewChange?.(false);
        }}
      />
    );
  }

  if (destination === "rootly" && rootlyPreview) {
    return (
      <RootlyPreviewCard
        caseId={caseId}
        result={rootlyPreview}
        existing={existingRootly ?? null}
        onBack={() => selectDestination(null)}
        onCreated={(record) => {
          setSuccessRecord(record);
          onPreviewChange?.(false);
        }}
      />
    );
  }

  function openSavedRecord(record: DemoDownstreamRecord) {
    setDestination(null);
    setSuccessRecord(record);
    onPreviewChange?.(false);
  }

  const actions = (
    <div className="space-y-3">
      {(existingJira || existingRootly) && (
        <div className="rounded-md border border-border bg-subtle/40 px-3 py-2 text-sm text-foreground">
          <p className="font-medium">Saved demo records for this case</p>
          <ul className="mt-1 space-y-1 text-muted">
            {existingJira ? (
              <li>
                Jira ·{" "}
                <span className="font-mono text-[13px]">
                  {existingJira.externalReference}
                </span>
              </li>
            ) : null}
            {existingRootly ? (
              <li>
                Rootly ·{" "}
                <span className="font-mono text-[13px]">
                  {existingRootly.externalReference}
                </span>
              </li>
            ) : null}
          </ul>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() =>
            existingJira
              ? openSavedRecord(existingJira)
              : selectDestination("jira")
          }
        >
          {existingJira ? "View Jira issue" : "Create Jira issue"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={() =>
            existingRootly
              ? openSavedRecord(existingRootly)
              : selectDestination("rootly")
          }
        >
          {existingRootly ? "View Rootly incident" : "Create Rootly incident"}
        </Button>
      </div>
    </div>
  );

  if (landing) {
    return (
      <Card padding="lg" className="space-y-4">
        {landing}
        <div className="border-t border-border pt-4">{actions}</div>
      </Card>
    );
  }

  return actions;
}

function DemoRecordBadge() {
  return (
    <span className="inline-flex items-center rounded border border-slate-200 bg-subtle px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted">
      Simulated demo record
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-border py-2.5 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="min-w-0 text-[15px] leading-relaxed text-foreground">
        {children}
      </dd>
    </div>
  );
}

function EvidenceBlock({ evidence }: { evidence: string[] }) {
  if (evidence.length === 0) {
    return <p className="text-muted">Not recorded</p>;
  }
  const { prominent, remaining } = selectProminentEvidence(evidence, 3);
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {prominent.map((line) => (
          <li
            key={line}
            className="rounded-md border border-border bg-subtle/40 px-3 py-2 font-mono text-[13px] leading-snug"
          >
            {line}
          </li>
        ))}
      </ul>
      {remaining.length > 0 ? (
        <Disclosure summary="View all evidence" variant="link">
          <ul className="mt-2 space-y-2">
            {remaining.map((line) => (
              <li
                key={line}
                className="rounded-md border border-border bg-subtle/40 px-3 py-2 font-mono text-[13px] leading-snug"
              >
                {line}
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </div>
  );
}

function CreateConfirmFooter({
  caseId,
  destination,
  createLabel,
  existing,
  onBack,
  onCreated,
}: {
  caseId: string;
  destination: DemoDownstreamDestination;
  createLabel: string;
  existing: DemoDownstreamRecord | null;
  onBack: () => void;
  onCreated: (record: DemoDownstreamRecord) => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createDemoDownstreamAction,
    initialCreateState,
  );

  useEffect(() => {
    if (state.ok && state.record) {
      onCreated(state.record);
      if (state.caseId && state.caseId !== caseId) {
        router.refresh();
      }
    }
    // Intentionally keyed on the saved record id to avoid re-entry loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCreated is stable enough for success handoff
  }, [state.ok, state.record?.id, state.caseId, caseId, router]);

  if (existing) {
    return (
      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm text-foreground">
          Simulated {destination === "jira" ? "Jira issue" : "Rootly incident"}{" "}
          already saved as{" "}
          <span className="font-mono text-[13px]">
            {existing.externalReference}
          </span>
          .
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onBack}>
            Back to Create escalation
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => onCreated(existing)}
          >
            View saved record
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <p className="text-xs text-muted">
        Creates a simulated demo record in your private session. No external{" "}
        {destination === "jira" ? "Jira" : "Rootly"} ticket is opened.
      </p>
      {state.message && !state.ok ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <form action={formAction}>
        <input type="hidden" name="caseId" value={caseId} />
        <input type="hidden" name="destination" value={destination} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onBack}>
            Back to Create escalation
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Creating…" : createLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}

function DownstreamSuccessCard({
  record,
  customer,
  onBack,
}: {
  record: DemoDownstreamRecord;
  customer?: string | null;
  onBack: () => void;
}) {
  const destinationLabel =
    record.destination === "jira" ? "Jira" : "Rootly";
  const title =
    record.destination === "jira"
      ? "Simulated Jira issue created"
      : "Simulated Rootly incident created";

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <DemoRecordBadge />
      </div>
      <dl>
        <Field label="Reference">
          <span className="font-mono text-[14px]">
            {record.externalReference}
          </span>
        </Field>
        <Field label="Destination">{destinationLabel}</Field>
        <Field label="Source case">
          {stripDemoMarkersForDisplay(customer ?? "") || record.caseId}
        </Field>
        <Field label="Created">{formatDateTime(record.createdAt)}</Field>
      </dl>
      <p className="text-sm text-muted">
        {record.destination === "jira"
          ? "This is a simulated Jira issue created for this demo. No live Jira issue was created."
          : "This is a simulated Rootly incident created for this demo. No live Rootly incident was created."}
      </p>
      <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back to Create escalation
        </Button>
      </div>
    </Card>
  );
}

function JiraPreviewCard({
  caseId,
  result,
  existing,
  onBack,
  onCreated,
}: {
  caseId: string;
  result: DemoJiraResult;
  existing: DemoDownstreamRecord | null;
  onBack: () => void;
  onCreated: (record: DemoDownstreamRecord) => void;
}) {
  const p = result.preview;
  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">
          Jira issue preview
        </h3>
        <DemoRecordBadge />
      </div>

      <dl>
        <Field label="Issue title">{p.summary}</Field>
        <Field label="Customer">{p.customer}</Field>
        <Field label="Affected customer accounts">
          {p.affectedCustomers}
        </Field>
        <Field label="Product">{p.product}</Field>
        <Field label="Environment">{p.environment}</Field>
        <Field label="Priority">{p.priority}</Field>
        <Field label="Issue type">{p.issueType}</Field>
        <Field label="Issue description">
          <p className="whitespace-pre-wrap">{p.description}</p>
        </Field>
        <Field label="Expected behaviour">
          <p className="whitespace-pre-wrap">{p.expectedBehaviour}</p>
        </Field>
        <Field label="Actual behaviour">
          <p className="whitespace-pre-wrap">{p.actualBehaviour}</p>
        </Field>
        {p.reproductionSteps ? (
          <Field label="Steps to reproduce">
            <p className="text-sm text-muted">
              Verified: {p.reproductionResult}
            </p>
            <pre className="mt-1 whitespace-pre-wrap font-sans text-[15px] leading-relaxed">
              {p.reproductionSteps}
            </pre>
          </Field>
        ) : (
          <Field label="Steps to reproduce">Not recorded as verified</Field>
        )}
        <Field label="Troubleshooting performed">
          <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed">
            {p.troubleshooting}
          </pre>
        </Field>
        <Field label="Workaround">{p.workaround}</Field>
        <Field label="Relevant technical evidence">
          <EvidenceBlock evidence={p.evidence} />
        </Field>
      </dl>

      <CreateConfirmFooter
        caseId={caseId}
        destination="jira"
        createLabel="Create Jira issue"
        existing={existing}
        onBack={onBack}
        onCreated={onCreated}
      />
    </Card>
  );
}

function RootlyPreviewCard({
  caseId,
  result,
  existing,
  onBack,
  onCreated,
}: {
  caseId: string;
  result: DemoRootlyResult;
  existing: DemoDownstreamRecord | null;
  onBack: () => void;
  onCreated: (record: DemoDownstreamRecord) => void;
}) {
  const p = result.preview;
  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">
          Rootly incident preview
        </h3>
        <DemoRecordBadge />
      </div>

      <dl>
        <Field label="Incident title">{p.title}</Field>
        <Field label="Severity">
          <span className="capitalize">{p.severity}</span>
        </Field>
        <Field label="Affected service">{p.affectedService}</Field>
        <Field label="Customer impact">
          <p className="whitespace-pre-wrap">{p.customerImpact}</p>
        </Field>
        {p.issueStartTime ? (
          <Field label="Issue start time">{p.issueStartTime}</Field>
        ) : null}
        <Field label="Current situation">
          <p className="whitespace-pre-wrap">{p.currentSituation}</p>
        </Field>
        <Field label="Investigation findings">
          <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed">
            {p.investigationFindings}
          </pre>
        </Field>
        <Field label="Relevant technical evidence">
          <EvidenceBlock evidence={p.evidence} />
        </Field>
        {p.responseTeam ? (
          <Field label="Response team">{p.responseTeam}</Field>
        ) : null}
      </dl>

      <CreateConfirmFooter
        caseId={caseId}
        destination="rootly"
        createLabel="Create Rootly incident"
        existing={existing}
        onBack={onBack}
        onCreated={onCreated}
      />
    </Card>
  );
}

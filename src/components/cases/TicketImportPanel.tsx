"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  confirmTicketImportAction,
  listTicketProvidersAction,
  listTicketsAction,
  previewTicketAction,
  type ConfirmImportState,
  type TicketProviderOption,
} from "@/actions/ticket-import-actions";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import type { TicketImportDraft } from "@/lib/integrations/ticket-provider";
import type { TicketListItem } from "@/lib/integrations/ticket-provider";

const initialConfirm: ConfirmImportState = { ok: true };

/**
 * Freshdesk / demo ticket import preview + confirm.
 */
export function TicketImportPanel() {
  const [providers, setProviders] = useState<TicketProviderOption[]>([]);
  const [providerId, setProviderId] = useState("demo_freshdesk");
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [ticketId, setTicketId] = useState("");
  const [draft, setDraft] = useState<TicketImportDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmState, confirmAction, confirming] = useActionState(
    confirmTicketImportAction,
    initialConfirm,
  );

  useEffect(() => {
    startTransition(async () => {
      try {
        const list = await listTicketProvidersAction();
        setProviders(list);
        if (list[0]) {
          setProviderId(list[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load providers");
      }
    });
  }, []);

  useEffect(() => {
    if (!providerId) return;
    startTransition(async () => {
      try {
        setError(null);
        setDraft(null);
        const list = await listTicketsAction(providerId);
        setTickets(list);
        setTicketId(list[0]?.externalTicketId ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to list tickets");
        setTickets([]);
      }
    });
  }, [providerId]);

  function onPreview() {
    if (!ticketId.trim()) return;
    startTransition(async () => {
      try {
        setError(null);
        const next = await previewTicketAction({
          providerId,
          externalTicketId: ticketId.trim(),
        });
        setDraft(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Preview failed");
        setDraft(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card padding="md">
        <CardHeader
          title="Import from Freshdesk"
          description="Demo tickets work without credentials. Real Freshdesk is used only when server env is configured."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-muted" htmlFor="provider">
              Provider
            </label>
            <select
              id="provider"
              value={providerId}
              onChange={(event) => setProviderId(event.target.value)}
              className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-sm"
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted" htmlFor="ticket">
              Ticket
            </label>
            <select
              id="ticket"
              value={ticketId}
              onChange={(event) => setTicketId(event.target.value)}
              className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-sm"
            >
              {tickets.length === 0 ? (
                <option value="">No tickets available</option>
              ) : (
                tickets.map((ticket) => (
                  <option
                    key={ticket.externalTicketId}
                    value={ticket.externalTicketId}
                  >
                    {ticket.externalTicketId} — {ticket.subject}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <Button type="button" onClick={onPreview} disabled={pending || !ticketId}>
            {pending ? "Loading…" : "Preview import"}
          </Button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </Card>

      {draft ? (
        <Card padding="md">
          <CardHeader
            title="Review imported fields"
            description={`${draft.sourceLabel} · ${draft.externalTicketId}`}
          />
          <div className="mb-4 rounded border border-warning/30 bg-warning-soft px-3 py-2">
            <p className="text-xs font-medium text-amber-950">Missing evidence</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-950/90">
              {draft.missingFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>

          <form action={confirmAction} className="space-y-3">
            <input
              type="hidden"
              name="draftJson"
              value={JSON.stringify(draft.createInput)}
            />
            <Field
              name="customer"
              label="Customer"
              defaultValue={draft.createInput.customer}
            />
            <Field
              name="product"
              label="Product"
              defaultValue={draft.createInput.product}
            />
            <Field
              name="issueTitle"
              label="Issue title"
              defaultValue={draft.createInput.issueTitle}
            />
            <TextArea
              name="issueDescription"
              label="Issue description"
              defaultValue={draft.createInput.issueDescription}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-muted">
                  Severity
                </label>
                <select
                  name="severity"
                  defaultValue={draft.createInput.severity}
                  className="mt-1 w-full rounded border border-border px-3 py-2 text-sm"
                >
                  <option value="critical">critical</option>
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted">
                  Environment
                </label>
                <select
                  name="environment"
                  defaultValue={draft.createInput.environment}
                  className="mt-1 w-full rounded border border-border px-3 py-2 text-sm"
                >
                  <option value="production">production</option>
                  <option value="staging">staging</option>
                  <option value="development">development</option>
                  <option value="unknown">unknown</option>
                </select>
              </div>
            </div>
            <TextArea
              name="troubleshootingPerformed"
              label="Troubleshooting performed"
              defaultValue={draft.createInput.troubleshootingPerformed}
            />
            <TextArea
              name="logsErrors"
              label="Logs / errors"
              defaultValue={draft.createInput.logsErrors}
            />
            <TextArea
              name="requestIds"
              label="Request / correlation IDs"
              defaultValue={draft.createInput.requestIds}
            />
            <TextArea
              name="stepsToReproduce"
              label="Steps to reproduce"
              defaultValue={draft.createInput.stepsToReproduce}
            />
            <TextArea
              name="expectedBehaviour"
              label="Expected behaviour"
              defaultValue={draft.createInput.expectedBehaviour}
            />
            <TextArea
              name="actualBehaviour"
              label="Actual behaviour"
              defaultValue={draft.createInput.actualBehaviour}
            />

            {confirmState.formError ? (
              <p className="text-sm text-danger" role="alert">
                {confirmState.formError}
                {confirmState.existingCaseId ? (
                  <>
                    {" "}
                    <a
                      className="underline"
                      href={`/cases/${confirmState.existingCaseId}`}
                    >
                      Open existing case
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}

            <Button type="submit" disabled={confirming}>
              {confirming ? "Saving…" : "Confirm and create case"}
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded border border-border px-3 py-2 text-sm"
      />
    </div>
  );
}

function TextArea({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted" htmlFor={name}>
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={3}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded border border-border px-3 py-2 font-mono text-[13px]"
      />
    </div>
  );
}

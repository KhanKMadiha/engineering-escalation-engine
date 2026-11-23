"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createTechnicalEvidenceAction,
  deleteTechnicalEvidenceAction,
  updateTechnicalEvidenceAction,
  type EvidenceActionState,
} from "@/actions/evidence-actions";
import { EvidenceDetailDialog } from "@/components/cases/evidence/EvidenceDetailDialog";
import { EvidenceLightbox } from "@/components/cases/evidence/EvidenceLightbox";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  evidenceSourceLabel,
  evidenceTypeLabel,
} from "@/lib/evidence/evidence-display";
import { evidenceBodyPreview } from "@/lib/evidence/evidence-preview";
import {
  TECHNICAL_EVIDENCE_SOURCES,
  TECHNICAL_EVIDENCE_TYPES,
  type TechnicalEvidenceRecord,
  type TechnicalEvidenceType,
} from "@/lib/evidence/evidence-types";
import { formatDateTime } from "@/lib/format";

type TechnicalEvidenceSidebarProps = {
  caseId: string;
  items: TechnicalEvidenceRecord[];
  /**
   * When false (default), public demo visitors can inspect existing evidence
   * only — Add / Delete UI is hidden. Mutation actions remain available when
   * explicitly enabled for internal tooling.
   */
  allowMutations?: boolean;
};

type FilterId = "all" | TechnicalEvidenceType;

const initialActionState: EvidenceActionState = { ok: false };

/**
 * Phase B Technical evidence rail — compact cards + full detail viewer.
 * Does not invent Datadog/Postman content. Source ≠ verification.
 */
export function TechnicalEvidenceSidebar({
  caseId,
  items,
  allowMutations = false,
}: TechnicalEvidenceSidebarProps) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [actionState, setActionState] =
    useState<EvidenceActionState>(initialActionState);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const byType = Object.fromEntries(
      TECHNICAL_EVIDENCE_TYPES.map((type) => [
        type,
        items.filter((item) => item.evidenceType === type).length,
      ]),
    ) as Record<TechnicalEvidenceType, number>;
    return { all: items.length, ...byType };
  }, [items]);

  const visible = items.filter((item) =>
    filter === "all" ? true : item.evidenceType === filter,
  );

  const activeTypes = TECHNICAL_EVIDENCE_TYPES.filter(
    (type) => counts[type] > 0,
  );
  const showFilters = items.length > 1 || activeTypes.length > 1;
  const detailItem = items.find((item) => item.id === detailId) ?? null;

  function onCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createTechnicalEvidenceAction(
        actionState,
        formData,
      );
      setActionState(result);
      if (result.ok) {
        setShowForm(false);
      }
    });
  }

  function onDelete(evidenceId: string, title: string) {
    const confirmed = window.confirm(
      `Delete technical evidence “${title}”? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }
    startTransition(async () => {
      const result = await deleteTechnicalEvidenceAction(caseId, evidenceId);
      setActionState(result);
      if (result.ok && detailId === evidenceId) {
        setDetailId(null);
      }
    });
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-h-[1.75rem] flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
          Technical evidence
        </h2>
        {allowMutations ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setShowForm((value) => !value);
              setActionState(initialActionState);
            }}
          >
            {showForm ? "Cancel" : "Add evidence"}
          </Button>
        ) : null}
      </div>
      {allowMutations ? (
        <p className="text-xs leading-relaxed text-muted">
          New evidence is saved on this case. It does not automatically update
          the Assessment recommendation.
        </p>
      ) : null}

      {allowMutations && showForm ? (
        <AddEvidenceForm
          caseId={caseId}
          pending={pending}
          actionState={actionState}
          onSubmit={onCreate}
        />
      ) : null}

      {allowMutations && actionState.formError && !showForm ? (
        <p className="text-sm text-danger" role="alert">
          {actionState.formError}
        </p>
      ) : null}

      {showFilters ? (
        <div
          className="flex flex-wrap gap-1"
          role="tablist"
          aria-label="Evidence categories"
        >
          <FilterTab
            selected={filter === "all"}
            label={`All (${counts.all})`}
            onClick={() => setFilter("all")}
          />
          {activeTypes.map((type) => (
            <FilterTab
              key={type}
              selected={filter === type}
              label={`${evidenceTypeLabel(type)} (${counts[type]})`}
              onClick={() => setFilter(type)}
            />
          ))}
        </div>
      ) : null}

      {visible.length > 0 ? (
        visible.map((item) => (
          <EvidenceRecordCard
            key={item.id}
            item={item}
            pending={pending}
            onOpen={() => setDetailId(item.id)}
            onDelete={
              allowMutations
                ? () => onDelete(item.id, item.title)
                : undefined
            }
          />
        ))
      ) : (
        <Card padding="sm">
          <p className="text-sm text-muted">
            No technical evidence recorded yet.
          </p>
        </Card>
      )}

      {detailItem ? (
        <EvidenceDetailPanel
          caseId={caseId}
          item={detailItem}
          pending={pending}
          onClose={() => setDetailId(null)}
          onDelete={
            allowMutations
              ? () => onDelete(detailItem.id, detailItem.title)
              : undefined
          }
          onUploadError={(message) =>
            setActionState({ ok: false, formError: message })
          }
        />
      ) : null}
    </div>
  );
}

function FilterTab({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`min-h-8 rounded-md px-2.5 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
        selected
          ? "bg-accent text-accent-foreground"
          : "bg-subtle text-muted hover:bg-accent-soft hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function AddEvidenceForm({
  caseId,
  pending,
  actionState,
  onSubmit,
}: {
  caseId: string;
  pending: boolean;
  actionState: EvidenceActionState;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <Card padding="sm">
      <h3 className="text-sm font-bold text-foreground">Add evidence</h3>
      <form
        className="mt-3 space-y-3"
        action={(formData) => onSubmit(formData)}
      >
        <input type="hidden" name="caseId" value={caseId} />
        <Field label="Evidence type" htmlFor="evidenceType">
          <select
            id="evidenceType"
            name="evidenceType"
            required
            className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm"
            defaultValue="application_log"
          >
            {TECHNICAL_EVIDENCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {evidenceTypeLabel(type)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title" htmlFor="title">
          <input
            id="title"
            name="title"
            required
            maxLength={200}
            className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm"
            placeholder="e.g. API response — article GET"
          />
        </Field>
        <Field label="Service / endpoint" htmlFor="service">
          <input
            id="service"
            name="service"
            maxLength={200}
            className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm"
            placeholder="Optional"
          />
        </Field>
        <Field label="Technical content" htmlFor="body">
          <textarea
            id="body"
            name="body"
            rows={5}
            className="w-full rounded-md border border-border bg-surface px-2.5 py-2 font-mono text-[12px]"
            placeholder="Paste logs, API response, or leave blank for screenshot-only"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Request ID" htmlFor="requestId">
            <input
              id="requestId"
              name="requestId"
              className="w-full rounded-md border border-border bg-surface px-2.5 py-2 font-mono text-[12px]"
            />
          </Field>
          <Field label="Trace ID" htmlFor="traceId">
            <input
              id="traceId"
              name="traceId"
              className="w-full rounded-md border border-border bg-surface px-2.5 py-2 font-mono text-[12px]"
            />
          </Field>
        </div>
        <Field label="Captured at" htmlFor="capturedAt">
          <input
            id="capturedAt"
            name="capturedAt"
            type="datetime-local"
            className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm"
          />
        </Field>
        <Field label="Source" htmlFor="source">
          <select
            id="source"
            name="source"
            className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm"
            defaultValue="support"
          >
            {TECHNICAL_EVIDENCE_SOURCES.filter(
              (source) => source !== "demo_fictional",
            ).map((source) => (
              <option key={source} value={source}>
                {evidenceSourceLabel(source)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Screenshot (optional)" htmlFor="screenshot">
          <input
            id="screenshot"
            name="screenshot"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="block w-full text-sm text-muted"
          />
        </Field>
        <Field label="Screenshot caption" htmlFor="caption">
          <input
            id="caption"
            name="caption"
            maxLength={500}
            className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm"
          />
        </Field>
        {actionState.formError ? (
          <p className="text-sm text-danger" role="alert">
            {actionState.formError}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save evidence"}
        </Button>
      </form>
    </Card>
  );
}

function EvidenceRecordCard({
  item,
  pending,
  onOpen,
  onDelete,
}: {
  item: TechnicalEvidenceRecord;
  pending: boolean;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  const preview = evidenceBodyPreview(item.body);
  const thumb = item.attachments.find((attachment) => attachment.previewUrl);

  return (
    <Card padding="sm">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {evidenceTypeLabel(item.evidenceType)}
          </p>
          <h3 className="mt-0.5 text-sm font-semibold leading-snug text-foreground">
            {item.title.replace(/^\[FICTIONAL DEMO\]\s*/i, "")}
          </h3>
          {item.service ? (
            <p className="mt-0.5 truncate text-xs text-muted">{item.service}</p>
          ) : null}
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            onClick={onOpen}
            className="text-xs font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
          >
            View
          </button>
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="text-xs font-medium text-muted outline-none hover:text-danger focus-visible:ring-2 focus-visible:ring-accent"
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>

      {preview ? (
        <pre className="mt-2 max-h-[4.5rem] overflow-hidden whitespace-pre-wrap break-words rounded-md bg-subtle/80 p-2 font-mono text-[11px] leading-relaxed text-foreground">
          {preview}
        </pre>
      ) : null}

      {thumb?.previewUrl ? (
        <div className="mt-2">
          <EvidenceLightbox
            src={thumb.previewUrl}
            alt={thumb.fileName}
            caption={item.caption}
          />
        </div>
      ) : null}

      <div className="mt-2 space-y-0.5">
        {item.capturedAt ? (
          <p className="text-xs text-muted">
            {formatDateTime(item.capturedAt) || item.capturedAt}
          </p>
        ) : null}
        {item.requestId ? (
          <p className="truncate font-mono text-[11px] text-muted">
            {item.requestId}
          </p>
        ) : null}
        {item.traceId && !item.requestId ? (
          <p className="truncate font-mono text-[11px] text-muted">
            {item.traceId}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function EvidenceDetailPanel({
  caseId,
  item,
  onClose,
  onDelete,
  onUploadError,
}: {
  caseId: string;
  item: TechnicalEvidenceRecord;
  pending: boolean;
  onClose: () => void;
  onDelete?: () => void;
  onUploadError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const canManage = item.source !== "demo_fictional";

  function onSave(formData: FormData) {
    startSave(async () => {
      const result = await updateTechnicalEvidenceAction(
        caseId,
        item.id,
        formData,
      );
      if (!result.ok) {
        setEditError(result.formError ?? "Unable to update evidence.");
        return;
      }
      setEditError(null);
      setEditing(false);
    });
  }

  if (editing && canManage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20242a]/70 p-4">
        <div className="relative z-10 max-h-[90vh] w-full max-w-[min(720px,95vw)] overflow-auto rounded-lg bg-surface p-4 shadow-xl">
          <h3 className="text-sm font-bold text-foreground">Edit evidence</h3>
          <form className="mt-3 space-y-3" action={onSave}>
            <Field label="Evidence type" htmlFor={`edit-type-${item.id}`}>
              <select
                id={`edit-type-${item.id}`}
                name="evidenceType"
                defaultValue={item.evidenceType}
                className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm"
              >
                {TECHNICAL_EVIDENCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {evidenceTypeLabel(type)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title" htmlFor={`edit-title-${item.id}`}>
              <input
                id={`edit-title-${item.id}`}
                name="title"
                required
                maxLength={200}
                defaultValue={item.title}
                className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm"
              />
            </Field>
            <Field label="Service / endpoint" htmlFor={`edit-service-${item.id}`}>
              <input
                id={`edit-service-${item.id}`}
                name="service"
                defaultValue={item.service ?? ""}
                className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm"
              />
            </Field>
            <Field label="Technical content" htmlFor={`edit-body-${item.id}`}>
              <textarea
                id={`edit-body-${item.id}`}
                name="body"
                rows={10}
                defaultValue={item.body ?? ""}
                className="w-full rounded-md border border-border bg-surface px-2.5 py-2 font-mono text-[12px]"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Request ID" htmlFor={`edit-req-${item.id}`}>
                <input
                  id={`edit-req-${item.id}`}
                  name="requestId"
                  defaultValue={item.requestId ?? ""}
                  className="w-full rounded-md border border-border bg-surface px-2.5 py-2 font-mono text-[12px]"
                />
              </Field>
              <Field label="Trace ID" htmlFor={`edit-trace-${item.id}`}>
                <input
                  id={`edit-trace-${item.id}`}
                  name="traceId"
                  defaultValue={item.traceId ?? ""}
                  className="w-full rounded-md border border-border bg-surface px-2.5 py-2 font-mono text-[12px]"
                />
              </Field>
            </div>
            {editError ? (
              <p className="text-sm text-danger" role="alert">
                {editError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <EvidenceDetailDialog
      caseId={caseId}
      item={item}
      canAttach={canManage}
      onClose={onClose}
      onUploadError={onUploadError}
      onEdit={
        canManage
          ? () => {
              setEditing(true);
            }
          : undefined
      }
      onDelete={onDelete}
    />
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

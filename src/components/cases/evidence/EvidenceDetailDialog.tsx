"use client";

import { useEffect, useId, useTransition } from "react";
import { addEvidenceScreenshotAction } from "@/actions/evidence-actions";
import { EvidenceLightbox } from "@/components/cases/evidence/EvidenceLightbox";
import { Button } from "@/components/ui/Button";
import {
  evidenceProvenanceLines,
  evidenceTypeLabel,
} from "@/lib/evidence/evidence-display";
import type { TechnicalEvidenceRecord } from "@/lib/evidence/evidence-types";
import { formatDateTime } from "@/lib/format";

type EvidenceDetailDialogProps = {
  caseId: string;
  item: TechnicalEvidenceRecord;
  canAttach: boolean;
  onClose: () => void;
  onUploadError: (message: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

/**
 * Full-size technical evidence viewer — monospace body, metadata, screenshots.
 * Presentation only; does not alter stored evidence content.
 */
export function EvidenceDetailDialog({
  caseId,
  item,
  canAttach,
  onClose,
  onUploadError,
  onEdit,
  onDelete,
}: EvidenceDetailDialogProps) {
  const titleId = useId();
  const [uploading, startUpload] = useTransition();
  const provenance = evidenceProvenanceLines(item);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onUpload(formData: FormData) {
    startUpload(async () => {
      const result = await addEvidenceScreenshotAction(
        caseId,
        item.id,
        formData,
      );
      if (!result.ok && result.formError) {
        onUploadError(result.formError);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#20242a]/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default"
        aria-label="Close evidence detail"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-[min(860px,95vw)] flex-col overflow-hidden rounded-lg bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3
              id={titleId}
              className="text-base font-bold text-foreground"
            >
              {item.title}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {evidenceTypeLabel(item.evidenceType)}
              {item.service ? ` · ${item.service}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {onEdit ? (
              <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
                Edit
              </Button>
            ) : null}
            {onDelete ? (
              <Button type="button" variant="secondary" size="sm" onClick={onDelete}>
                Delete
              </Button>
            ) : null}
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-4">
          {item.body ? (
            <pre className="overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-slate-50 p-3 font-mono text-[12px] leading-relaxed text-slate-800">
              {item.body}
            </pre>
          ) : (
            <p className="text-sm text-muted">
              No technical text recorded for this item.
            </p>
          )}

          {item.attachments.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                Screenshots
              </p>
              <div className="flex flex-wrap gap-2">
                {item.attachments.map((attachment) =>
                  attachment.previewUrl ? (
                    <EvidenceLightbox
                      key={attachment.id}
                      src={attachment.previewUrl}
                      alt={attachment.fileName}
                      caption={item.caption}
                    />
                  ) : (
                    <p key={attachment.id} className="text-xs text-muted">
                      {attachment.fileName}
                    </p>
                  ),
                )}
              </div>
              {item.caption ? (
                <p className="mt-2 text-xs text-muted">{item.caption}</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1 border-t border-border pt-3">
            {item.capturedAt ? (
              <p className="text-xs text-muted">
                Timestamp:{" "}
                <span className="font-mono text-[11px] text-foreground">
                  {formatDateTime(item.capturedAt) || item.capturedAt}
                </span>
              </p>
            ) : null}
            {item.requestId ? (
              <p className="text-xs text-muted">
                Request ID:{" "}
                <span className="break-all font-mono text-[11px] text-foreground">
                  {item.requestId}
                </span>
              </p>
            ) : null}
            {item.traceId ? (
              <p className="text-xs text-muted">
                Trace ID:{" "}
                <span className="break-all font-mono text-[11px] text-foreground">
                  {item.traceId}
                </span>
              </p>
            ) : null}
            {provenance.map((line) => (
              <p key={line} className="text-xs text-muted">
                {line}
              </p>
            ))}
          </div>

          {canAttach ? (
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-medium text-muted">
                Attach screenshot
                <input
                  name="screenshot"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="mt-1 block w-full text-xs"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (!file) {
                      return;
                    }
                    const formData = new FormData();
                    formData.set("screenshot", file);
                    onUpload(formData);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

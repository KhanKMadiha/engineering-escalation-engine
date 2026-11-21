"use client";

import { useEffect, useId, useState } from "react";

type EvidenceLightboxProps = {
  src: string;
  alt: string;
  caption?: string | null;
};

/**
 * Accessible full-size image viewer for evidence screenshots.
 * Opens on demand; Escape / backdrop closes.
 */
export function EvidenceLightbox({ src, alt, caption }: EvidenceLightboxProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group block overflow-hidden rounded-md border border-border bg-subtle outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={`Open full-size: ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="h-24 w-auto max-w-full object-contain transition group-hover:opacity-90"
        />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#20242a]/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <button
            type="button"
            className="absolute inset-0 z-0 cursor-default"
            aria-label="Close image"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 max-h-[90vh] max-w-[min(960px,95vw)] overflow-auto rounded-lg bg-surface p-3 shadow-xl">
            <div className="mb-2 flex items-start justify-between gap-3">
              <p id={titleId} className="text-sm font-medium text-foreground">
                {caption?.trim() || alt}
              </p>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm text-muted hover:bg-subtle hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[80vh] w-auto max-w-full object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

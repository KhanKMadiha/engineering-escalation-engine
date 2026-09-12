"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
} from "react";

export const AI_PROVENANCE_TOOLTIP = {
  title: "AI-assessed",
  body: "This value was inferred from the case evidence. AI analysis is advisory and does not determine the escalation score or final decision.",
} as const;

type OpenReason = "hover" | "focus" | "click";

type AIProvenanceBadgeProps = {
  /** Visible badge label; defaults to compact "AI". */
  label?: string;
};

/**
 * Compact interactive AI provenance chip.
 * Hover, keyboard focus, and click/tap all reveal the same explanation.
 */
export function AIProvenanceBadge({ label = "AI" }: AIProvenanceBadgeProps) {
  const tooltipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [reason, setReason] = useState<OpenReason | null>(null);
  const open = reason !== null;

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setReason(null);
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setReason(null);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function showFromHover() {
    setReason((current) => (current === "click" ? current : "hover"));
  }

  function hideFromHover() {
    setReason((current) => (current === "hover" ? null : current));
  }

  function showFromFocus() {
    setReason((current) => (current === "click" ? current : "focus"));
  }

  function hideFromFocus(event: FocusEvent<HTMLButtonElement>) {
    if (rootRef.current?.contains(event.relatedTarget as Node)) {
      return;
    }
    setReason((current) => (current === "focus" ? null : current));
  }

  function toggleFromClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setReason((current) => (current === "click" ? null : "click"));
  }

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        className="inline-flex cursor-help items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-500 outline-none underline-offset-2 hover:border-slate-300 hover:underline focus-visible:ring-2 focus-visible:ring-slate-400"
        aria-expanded={open}
        aria-controls={tooltipId}
        aria-describedby={open ? tooltipId : undefined}
        aria-label={`${AI_PROVENANCE_TOOLTIP.title}. Activate for explanation.`}
        onClick={toggleFromClick}
        onMouseEnter={showFromHover}
        onMouseLeave={hideFromHover}
        onFocus={showFromFocus}
        onBlur={hideFromFocus}
      >
        {label}
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        hidden={!open}
        className="absolute left-0 top-full z-20 mt-1.5 w-56 rounded border border-slate-200 bg-white px-2.5 py-2 text-left shadow-sm"
      >
        <span className="block text-[11px] font-semibold text-slate-800">
          {AI_PROVENANCE_TOOLTIP.title}
        </span>
        <span className="mt-1 block text-[11px] leading-snug text-slate-600">
          {AI_PROVENANCE_TOOLTIP.body}
        </span>
      </span>
    </span>
  );
}

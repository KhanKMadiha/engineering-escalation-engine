"use client";

import { CircleHelp } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { AppIcon } from "@/components/ui/AppIcon";

type EscalationReadinessScoreProps = {
  score: number;
  /** Assessment hero uses a larger score; Overview keeps the compact default. */
  size?: "md" | "lg";
};

const READINESS_HELP =
  "This score is calculated using predefined escalation rules and validated case evidence. It is not an AI confidence score. A human reviewer makes the final escalation decision.";

/**
 * Compact readiness score with an accessible info popover.
 * Presentation only — does not alter scoring.
 */
export function EscalationReadinessScore({
  score,
  size = "md",
}: EscalationReadinessScoreProps) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | undefined>();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setPanelStyle(undefined);
      return;
    }

    function placePanel() {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const gutter = 16;
      const width = Math.min(288, window.innerWidth - gutter * 2);
      let left = Math.min(
        rect.right - width,
        window.innerWidth - gutter - width,
      );
      left = Math.max(gutter, left);
      const top = Math.min(rect.bottom + 8, window.innerHeight - gutter - 120);
      setPanelStyle({
        position: "fixed",
        top,
        left,
        width,
        maxWidth: `calc(100vw - ${gutter * 2}px)`,
      });
    }

    placePanel();
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", placePanel, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((value) => !value);
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative sm:min-w-[9.5rem] sm:text-right"
      aria-label="Escalation readiness score"
    >
      <div className="inline-flex items-center gap-1.5 sm:justify-end">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Escalation readiness
        </p>
        <button
          ref={buttonRef}
          type="button"
          className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-full p-1 text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          aria-label="About escalation readiness score"
          aria-expanded={open}
          aria-controls={panelId}
          aria-haspopup="dialog"
          onClick={() => setOpen((value) => !value)}
          onKeyDown={onButtonKeyDown}
        >
          <AppIcon icon={CircleHelp} size={14} />
        </button>
      </div>

      <p
        className={`mt-1.5 font-mono font-semibold tabular-nums text-foreground ${
          size === "lg" ? "text-4xl sm:text-5xl" : "text-3xl"
        }`}
      >
        {score}
        <span
          className={`font-medium text-muted ${
            size === "lg" ? "text-lg" : "text-base"
          }`}
        >
          {" "}
          / 100
        </span>
      </p>

      {size === "lg" ? (
        <div
          className="mt-3 h-1.5 w-full max-w-[11rem] overflow-hidden rounded-full bg-border sm:ml-auto"
          role="presentation"
        >
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>
      ) : null}

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Escalation readiness explanation"
          style={panelStyle}
          className="z-50 rounded-lg border border-border bg-surface p-3 text-left text-xs leading-snug text-muted shadow-[var(--shadow-card)]"
        >
          {READINESS_HELP}
        </div>
      ) : null}
    </div>
  );
}

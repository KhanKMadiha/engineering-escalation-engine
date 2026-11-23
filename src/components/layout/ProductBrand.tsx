/**
 * Product mark + wordmark for the charcoal sidebar.
 * Lightweight inline SVG — structured layers suggesting investigation → decision → handoff.
 */
export function ProductBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex min-w-0 items-start ${compact ? "gap-2.5" : "gap-3.5"}`}
    >
      <span
        className={`flex shrink-0 items-center justify-center ${
          compact ? "h-9 w-9" : "h-10 w-10"
        }`}
        aria-hidden
      >
        <svg
          viewBox="0 0 32 32"
          className={compact ? "h-8 w-8 text-[#3d9b84]" : "h-9 w-9 text-[#3d9b84]"}
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7 7.2 16 3.2l9 4v3.1L16 14.2 7 10.3V7.2Z"
            opacity="0.95"
          />
          <path
            d="M7 14.4 16 10.4l9 4v3.1L16 21.4 7 17.5v-3.1Z"
            opacity="0.72"
          />
          <path
            d="M7 21.6 16 17.6l9 4v3.1L16 28.6 7 24.7v-3.1Z"
            opacity="0.5"
          />
        </svg>
      </span>
      <div className={`min-w-0 ${compact ? "pt-0.5" : "pt-1"}`}>
        <p
          className={`font-semibold tracking-tight text-sidebar-foreground ${
            compact
              ? "text-[13px] leading-snug"
              : "text-[14px] leading-snug"
          }`}
        >
          Engineering Escalation Engine
        </p>
        <p
          className={`truncate leading-none text-sidebar-muted ${
            compact ? "mt-1 text-[11px]" : "mt-1.5 text-xs"
          }`}
        >
          Support Operations
        </p>
      </div>
    </div>
  );
}

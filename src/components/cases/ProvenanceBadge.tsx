import { AIProvenanceBadge } from "@/components/cases/AIProvenanceBadge";
import type { ProvenanceSource } from "@/lib/provenance/types";

/** Short UI labels — stored provenance enum values are unchanged. */
const LABELS: Record<Exclude<ProvenanceSource, "ai_inference">, string> = {
  customer_provided: "Customer",
  extracted_evidence: "Verified",
  deterministic_engine: "Rules",
  human_decision: "Human",
  engineering_handoff: "Handoff",
};

/** Restrained provenance chips — do not compete with status/severity. */
type ProvenanceBadgeProps = {
  source: ProvenanceSource;
  label?: string;
};

export function ProvenanceBadge({ source, label }: ProvenanceBadgeProps) {
  if (source === "ai_inference") {
    return <AIProvenanceBadge label={label} />;
  }

  return (
    <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-500">
      {label ?? LABELS[source]}
    </span>
  );
}

/** Presentation-only badge for future integrations (not a domain provenance). */
export function IntegrationsBadge() {
  return (
    <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-500">
      Integrations
    </span>
  );
}

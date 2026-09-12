import type { CaseEvent, CaseEventType } from "@/types";

const EVENT_LABELS: Record<CaseEventType, string> = {
  case_created: "Case reported",
  case_submitted: "Submitted",
  analysis_started: "Analysis started",
  analysis_completed: "AI analysis completed",
  analysis_failed: "AI analysis failed",
  escalation_evaluated: "Escalation assessed",
  escalation_evaluation_failed: "Escalation evaluation failed",
  human_decision_recorded: "Human decision recorded",
  engineering_handoff_created: "Engineering handoff created",
  decision_recorded: "Decision recorded",
  status_changed: "Status changed",
};

/** Presentation label for an audit event type — no new semantics. */
export function auditEventLabel(eventType: CaseEventType): string {
  return EVENT_LABELS[eventType];
}

/**
 * Human-readable timeline label for an existing event.
 * Softens known status transitions without inventing events.
 */
export function auditEventDisplayLabel(event: CaseEvent): string {
  if (event.eventType === "status_changed") {
    const to = event.metadata?.to ?? event.metadata?.status;
    if (to === "awaiting_decision") {
      return "Awaiting human decision";
    }
  }
  return auditEventLabel(event.eventType);
}

/**
 * Optional short detail line from existing event metadata only.
 * Does not invent values.
 */
export function auditEventDetail(event: CaseEvent): string | null {
  const meta = event.metadata;
  if (!meta) {
    return null;
  }

  if (
    event.eventType === "escalation_evaluated" &&
    typeof meta.score === "number"
  ) {
    const recommendation =
      typeof meta.recommendation === "string"
        ? ` · ${formatRecommendation(meta.recommendation)}`
        : "";
    return `${meta.score} / 100${recommendation}`;
  }

  if (
    event.eventType === "status_changed" &&
    typeof meta.to === "string"
  ) {
    if (meta.to === "awaiting_decision") {
      return null;
    }
    return meta.to.replaceAll("_", " ");
  }

  if (
    event.eventType === "status_changed" &&
    typeof meta.status === "string"
  ) {
    if (meta.status === "awaiting_decision") {
      return null;
    }
    return meta.status.replaceAll("_", " ");
  }

  if (
    (event.eventType === "human_decision_recorded" ||
      event.eventType === "decision_recorded") &&
    typeof meta.decision === "string"
  ) {
    if (meta.decision === "approved") {
      return "Approved";
    }
    if (meta.decision === "rejected") {
      // DecisionService reject always continues investigation — use operational label.
      return "Continue investigation";
    }
    return meta.decision.replaceAll("_", " ");
  }

  if (
    event.eventType === "analysis_failed" &&
    typeof meta.message === "string"
  ) {
    return meta.message.slice(0, 120);
  }

  return null;
}

function formatRecommendation(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Compact clock time for timeline rows. */
export function formatAuditTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

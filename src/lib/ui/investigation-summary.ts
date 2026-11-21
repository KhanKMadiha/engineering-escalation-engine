import {
  formatCompactIssueFirstObserved,
  shortenText,
  troubleshootingSummaryLines,
} from "@/lib/ui/case-display";
import { stripDemoDescriptionBoilerplate } from "@/lib/demo/demo-cases";
import { formatDateTime, formatIssueFirstObserved } from "@/lib/format";
import type { CaseRecord } from "@/types";

export type ImpactTimelineProvenance =
  | "system"
  | "customer_support"
  | "not_recorded"
  | "ai_interpretation";

export type ImpactTimelineRow = {
  label: string;
  value: string;
  provenance: ImpactTimelineProvenance;
};

export type ImpactTimeline = {
  rows: ImpactTimelineRow[];
};

export type TroubleshootingItemKind = "performed" | "unresolved";

export type TroubleshootingItem = {
  kind: TroubleshootingItemKind;
  text: string;
};

export type TroubleshootingGroups = {
  performed: TroubleshootingItem[];
  unresolved: TroubleshootingItem[];
};

export type ReproductionStatusDisplay = {
  label: string;
  /** AI-assessed values are advisory only. */
  provenance: "ai_interpretation" | "unknown";
};

export type ReproductionResultDisplay = {
  /** Recorded Support / customer reproduction outcome — not AI frequency. */
  label: string;
  provenance: "customer_support";
};

export type InvestigationOverview = {
  /** One concise sentence — affected functionality and high-level issue. */
  summary: string;
  /** Product when recorded; shown as "Affected product" (presentation label). */
  affectedProduct: string | null;
};

export type ReproductionStepsPresentation = {
  /** Actionable reproduction instructions only. */
  steps: string[];
  /**
   * Recorded comments about intermittency, reproducibility, or incomplete
   * testing — excluded from the numbered list (Frequency / result handle them).
   */
  statusNotes: string[];
};

export type TechnicalEvidenceItem = {
  id: string;
  category: "logs" | "api" | "other";
  title: string;
  statusLabel: string;
  statusTone: "reported" | "available" | "pending" | "empty";
  body: string;
  source: string;
  /** Genuine correlation / request / trace ID only — never placeholders. */
  correlationId?: string | null;
  /** Optional service / product / component label when recorded. */
  service?: string | null;
  /** Optional captured-at timestamp when recorded on the artefact or case. */
  timestamp?: string | null;
};

/**
 * Concise Overview: one sentence on affected functionality + high-level issue.
 * Omits environment (shown in the case header), investigation-status prose,
 * and possible-cause speculation. Does not copy Actual behaviour verbatim.
 */
export function buildInvestigationOverview(
  record: CaseRecord,
): InvestigationOverview {
  const affectedProduct = record.product.trim() || null;
  const description = stripDemoDescriptionBoilerplate(
    record.issueDescription,
  ).trim();
  const title = stripDemoMarker(record.issueTitle);

  const summaryLine =
    description
      .split(/\n+/)
      .map((line) => collapseWhitespace(line))
      .filter(Boolean)
      .find((line) => !isOverviewNoiseLine(line)) ?? "";

  let summary = summaryLine;
  if (!summary && title) {
    summary = title;
  }
  if (!summary && affectedProduct) {
    summary = `${affectedProduct} issue under investigation.`;
  }

  return {
    summary: summary ? shortenText(summary, 220) : "",
    affectedProduct,
  };
}

export function buildTroubleshootingGroups(
  troubleshootingPerformed: string,
): TroubleshootingGroups {
  const performed: TroubleshootingItem[] = [];
  const unresolved: TroubleshootingItem[] = [];

  for (const line of troubleshootingSummaryLines(
    troubleshootingPerformed,
    12,
  )) {
    if (isUnresolvedTroubleshootingLine(line)) {
      unresolved.push({ kind: "unresolved", text: line });
    } else {
      performed.push({ kind: "performed", text: line });
    }
  }

  return { performed, unresolved };
}

export function buildTroubleshootingPerformed(
  troubleshootingPerformed: string,
): string[] {
  return buildTroubleshootingGroups(troubleshootingPerformed).performed.map(
    (item) => item.text,
  );
}

/**
 * Actionable next steps from unresolved troubleshooting and recommended steps.
 * Presentation-only consolidation — does not mutate stored investigation data.
 * Drops generic incompleteness, human-review workflow instructions, and
 * near-duplicate themes (e.g. two permission checks).
 *
 * Source: analysis.aiResult.recommendedNextSteps / missingEvidence plus
 * unresolved troubleshooting lines. Human-review phrasing is filtered here
 * so Investigation > Next steps stays technical; Human decision owns approval.
 */
export function buildInvestigationNextSteps(record: CaseRecord): string[] {
  const steps: string[] = [];
  const seenExact = new Set<string>();
  const seenThemes = new Set<string>();

  function push(raw: string) {
    const text = raw.trim().replace(/\s+/g, " ");
    if (
      !text ||
      isGenericIncompleteness(text) ||
      isHumanReviewWorkflowStep(text)
    ) {
      return;
    }
    const exact = normalizeStepKey(text);
    if (seenExact.has(exact)) {
      return;
    }
    const theme = thematicStepKey(text);
    if (theme && seenThemes.has(theme)) {
      return;
    }
    seenExact.add(exact);
    if (theme) {
      seenThemes.add(theme);
    }
    steps.push(text);
  }

  const { unresolved } = buildTroubleshootingGroups(
    record.troubleshootingPerformed,
  );
  for (const item of unresolved) {
    const actionable = toActionableNextStep(item.text);
    if (actionable) {
      push(actionable);
    }
  }

  for (const item of record.analysis?.aiResult.recommendedNextSteps ?? []) {
    push(item);
  }

  // Fall back to missingEvidence only when the list is still thin.
  if (steps.length < 3) {
    for (const item of record.analysis?.aiResult.missingEvidence ?? []) {
      push(item);
    }
  }

  return steps.slice(0, 4);
}

/**
 * Workflow / Human decision instructions — not technical investigation steps.
 * Stored AI text is left unchanged; filtered only for Investigation presentation.
 */
export function isHumanReviewWorkflowStep(line: string): boolean {
  return (
    /\bhave a human reviewer\b/i.test(line) ||
    /\bhuman reviewer (should |must )?(approve|reject)\b/i.test(line) ||
    /\bapprove or reject escalation\b/i.test(line) ||
    /\bbased on the engine score\b/i.test(line) ||
    /\brecord (a |the )?human (decision|approval)\b/i.test(line)
  );
}

export function buildTroubleshootingBullets(
  troubleshootingPerformed: string,
  maxItems = 6,
): string[] {
  return buildTroubleshootingPerformed(troubleshootingPerformed).slice(
    0,
    maxItems,
  );
}

export function establishedRootCause(record: CaseRecord): string | null {
  void record;
  return null;
}

/** No verified workaround field exists on the case model today. */
export function establishedWorkaround(record: CaseRecord): string | null {
  void record;
  return null;
}

/**
 * Compact Impact & timeline for the mockup grid.
 * Never infers affected users from affected organisations.
 * Impact scope is omitted from presentation (org count already shown).
 * Last known working is included only when recorded and meaningful.
 */
export function buildImpactTimeline(record: CaseRecord): ImpactTimeline {
  const customerCount = record.affectedCustomerCount;

  const issueStartedRaw = formatIssueFirstObserved({
    issueFirstObserved: record.issueFirstObserved,
    incidentTimestamp: record.incidentTimestamp,
  });
  const issueStarted = issueStartedRaw
    ? formatCompactIssueFirstObserved(issueStartedRaw)
    : "";

  const rows: ImpactTimelineRow[] = [
    {
      label: "Reported",
      value: formatDateTime(record.createdAt) || "Not recorded",
      provenance: "system",
    },
    {
      label: "Issue started",
      value: issueStarted || "Not recorded",
      provenance: issueStarted ? "customer_support" : "not_recorded",
    },
    issueFrequencyRow(record),
    {
      label: "Affected users",
      value: "Not recorded",
      provenance: "not_recorded",
    },
    {
      label: "Affected organisations",
      value: customerCount === null ? "Not recorded" : String(customerCount),
      provenance: customerCount !== null ? "customer_support" : "not_recorded",
    },
  ];

  const lastKnownWorking = lastKnownWorkingRow(record);
  if (lastKnownWorking) {
    rows.push(lastKnownWorking);
  }

  return { rows };
}

/**
 * Issue occurrence frequency from explicitly reported / verified behaviour.
 * Does not use unsupported AI reproducibility, and does not treat
 * "fails in public / works in private" condition notes as frequency.
 */
export function issueFrequencyRow(record: CaseRecord): ImpactTimelineRow {
  const reported = explicitReportedFrequency(record);
  if (reported) {
    return {
      label: "Frequency",
      value: reported,
      provenance: "customer_support",
    };
  }

  return {
    label: "Frequency",
    value: "Unknown",
    provenance: "not_recorded",
  };
}

/** Last known working — omitted from the grid when not recorded. */
export function lastKnownWorkingRow(
  record: CaseRecord,
): ImpactTimelineRow | null {
  void record;
  // No verified last-known-working field on the case model today.
  return null;
}

/**
 * Organisation-level scope from customer count only.
 * Does not claim single-user / entire-organisation user impact.
 */
export function impactScopeFromCustomerCount(
  affectedCustomerCount: number | null,
): string {
  if (affectedCustomerCount === null) {
    return "Unknown";
  }
  if (affectedCustomerCount > 1) {
    return "Multiple organisations";
  }
  if (affectedCustomerCount === 1) {
    return "Single organisation";
  }
  return "Unknown";
}

/**
 * @deprecated Prefer issueFrequencyRow for Impact & timeline.
 * Kept for callers that still map AI reproducibility labels.
 */
export function reproductionStatusDisplay(
  record: CaseRecord,
): ReproductionStatusDisplay | null {
  const value = record.analysis?.aiResult.reproducibility?.trim();
  if (!value) {
    return null;
  }
  const labelMap: Record<string, string> = {
    confirmed: "Reproduced",
    intermittent: "Intermittent",
    not_reproduced: "Not reproduced",
    unknown: "Unknown",
  };
  return {
    label: labelMap[value] ?? value.replaceAll("_", " "),
    provenance: "ai_interpretation",
  };
}

/**
 * Compact reproduction outcome only when Support/customer recorded a result.
 * AI intermittency / frequency is not treated as successful reproduction.
 */
export function reproductionResultDisplay(
  stepsToReproduce: string,
): ReproductionResultDisplay | null {
  const { statusNotes } = splitReproductionSteps(stepsToReproduce);
  for (const note of statusNotes) {
    if (isRecordedReproductionResult(note)) {
      return { label: note, provenance: "customer_support" };
    }
  }
  return null;
}

/**
 * Split recorded reproduction text into actionable steps vs status notes.
 * Presentation only — does not mutate stored case data or invent results.
 */
export function splitReproductionSteps(
  stepsToReproduce: string,
): ReproductionStepsPresentation {
  const steps: string[] = [];
  const statusNotes: string[] = [];

  for (const raw of stepsToReproduce.split(/\r?\n/)) {
    const line = raw.trim().replace(/^\d+\.\s*/, "").trim();
    if (!line) {
      continue;
    }
    if (isReproductionStatusNote(line) || isRecordedReproductionResult(line)) {
      statusNotes.push(line);
    } else {
      steps.push(line);
    }
  }

  return { steps, statusNotes };
}

/** Actionable reproduction steps only (status notes excluded). */
export function parseReproductionSteps(stepsToReproduce: string): string[] {
  return splitReproductionSteps(stepsToReproduce).steps;
}

/**
 * Technical evidence cards from recorded diagnostic artefacts only.
 * Customer observations that belong in Overview / Actual behaviour are omitted.
 * No fabricated Datadog / Postman / screenshot rows.
 */
export function buildTechnicalEvidenceItems(
  record: CaseRecord,
): TechnicalEvidenceItem[] {
  const body = record.logsErrors.trim();
  if (!body) {
    return [];
  }

  // Observational notes are not technical evidence (Phase A).
  if (!isDiagnosticArtefact(body)) {
    return [];
  }

  const classified = classifyDiagnosticEvidenceBody(body, record.product);
  const correlation = correlationReferenceDisplay(record.requestIds);
  const correlationId =
    (!correlation.isPlaceholder ? correlation.value : null) ??
    extractRequestIdFromBody(body);

  const timestamp =
    extractTimestampFromBody(body) ??
    (record.incidentTimestamp
      ? formatDateTime(record.incidentTimestamp) || record.incidentTimestamp
      : null);

  return [
    {
      id: classified.id,
      category: classified.category,
      title: classified.title,
      statusLabel: "Recorded",
      statusTone: "reported",
      body,
      source: classified.source,
      correlationId,
      service: classified.service,
      timestamp,
    },
  ];
}

export type CorrelationDisplay = {
  value: string;
  isPlaceholder: boolean;
};

export function correlationReferenceDisplay(
  requestIds: string,
): CorrelationDisplay {
  const trimmed = requestIds.trim();
  if (!trimmed) {
    return { value: "Not provided", isPlaceholder: true };
  }

  const partialNote = /^Partial correlation note:\s*(.+)$/i.exec(trimmed);
  if (partialNote?.[1]) {
    const value = partialNote[1].trim();
    return {
      value,
      isPlaceholder:
        /pending|placeholder|n\/a|none|not provided/i.test(value) ||
        value.endsWith("-pending"),
    };
  }

  if (/^no correlation id provided\b/i.test(trimmed)) {
    return { value: "Not provided", isPlaceholder: true };
  }

  return { value: trimmed, isPlaceholder: false };
}

export function investigationProgressLabel(
  status: CaseRecord["status"],
): string | null {
  switch (status) {
    case "analyzing":
    case "investigation_continues":
      return "In progress";
    case "awaiting_decision":
      return "Awaiting decision";
    case "escalated":
      return "Escalated";
    default:
      return null;
  }
}

function toActionableNextStep(line: string): string | null {
  if (isGenericIncompleteness(line)) {
    return null;
  }

  const askedWhether = /^Asked whether\s+(.+)$/i.exec(line);
  if (askedWhether?.[1]) {
    return `Confirm whether ${trimTrailingPeriod(askedWhether[1])}.`;
  }

  const asked = /^Asked for\s+(.+)$/i.exec(line);
  if (asked?.[1]) {
    return `Obtain ${trimTrailingPeriod(asked[1])}.`;
  }

  const requested = /^Requested\s+(.+)$/i.exec(line);
  if (requested?.[1]) {
    return `Collect ${trimTrailingPeriod(requested[1])}.`;
  }

  return line;
}

function isGenericIncompleteness(line: string): boolean {
  return (
    /^troubleshooting is incomplete\b/i.test(line) ||
    /^configuration versus product defect is not yet\b/i.test(line) ||
    (/^(troubleshooting|configuration)\b/i.test(line) &&
      /\b(incomplete|not fully ruled out|not yet established)\b/i.test(line))
  );
}

function isUnresolvedTroubleshootingLine(line: string): boolean {
  if (/^(asked|requested)\b/i.test(line)) {
    return true;
  }
  if (isGenericIncompleteness(line)) {
    return true;
  }
  return false;
}

function normalizeStepKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(confirm whether|collect|obtain|compare|verify|complete)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Coarse theme for collapsing semantically equivalent next-step phrasing.
 * Distinct themes (permissions vs webhook logs vs reproduction) are kept.
 */
function thematicStepKey(text: string): string | null {
  const t = text.toLowerCase();
  // Check log/webhook themes before permissions so "bot-permission logs" stays logs.
  if (
    /\b(webhook|activity.?logs?|log packages?|bot[- ]permission logs?)\b/.test(t)
  ) {
    return "webhook_activity_logs";
  }
  if (/\b(permissions?|membership)\b/.test(t)) {
    return "permissions_membership";
  }
  if (/\breproduc/.test(t)) {
    return "reproduction";
  }
  if (/\b(saml|certificate|idp|trust-?store)\b/.test(t)) {
    return "sso_certificate";
  }
  if (/\bcorrelation id\b/.test(t)) {
    return "correlation_ids";
  }
  return null;
}

function trimTrailingPeriod(value: string): string {
  return value.trim().replace(/\.$/, "");
}

function stripDemoMarker(value: string): string {
  return value.replace(/^\[DEMO\]\s*/i, "").trim();
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Status / speculation lines that do not belong in Overview. */
function isOverviewNoiseLine(line: string): boolean {
  return (
    /\binvestigation is ongoing\b/i.test(line) ||
    /\bengineering escalation would be premature\b/i.test(line) ||
    /\bmay still need to be ruled out\b/i.test(line) ||
    /\bpossible (cause|root cause)\b/i.test(line) ||
    /\b(permissions?|configuration|membership).{0,40}\b(ruled out|need to|not yet)\b/i.test(
      line,
    ) ||
    (/^(troubleshooting|configuration)\b/i.test(line) &&
      /\b(incomplete|ongoing|premature)\b/i.test(line))
  );
}

/**
 * Non-actionable reproduction commentary (intermittency, incomplete testing).
 * Excluded from the numbered steps list.
 */
function isReproductionStatusNote(line: string): boolean {
  return (
    /\bintermittent(ly)?\b/i.test(line) ||
    /\breproducib(le|ility)\b/i.test(line) ||
    /\breproduction is incomplete\b/i.test(line) ||
    /\bcontrolled reproduction\b/i.test(line) ||
    /\bincomplete testing\b/i.test(line) ||
    /\b(could not|unable to|not yet) reproduce\b/i.test(line) ||
    /^(note|n\.b\.|nb)[:.\s]/i.test(line)
  );
}

/** Clear Support/customer reproduction outcome — not frequency commentary. */
function isRecordedReproductionResult(line: string): boolean {
  if (/\bintermittent(ly)?\b/i.test(line)) {
    return false;
  }
  if (/\bincomplete\b/i.test(line)) {
    return false;
  }
  return (
    /\b(successfully|confirmed) reproduced\b/i.test(line) ||
    /\breproduced by support\b/i.test(line) ||
    /\bsupport (successfully )?reproduced\b/i.test(line) ||
    /\b(could not|unable to) reproduce\b/i.test(line) ||
    /\bnot reproduced by support\b/i.test(line)
  );
}

/**
 * Frequency from explicit customer/support language only.
 * Ignores condition notes such as "intermittent across channel types".
 * Does not consult AI reproducibility.
 */
function explicitReportedFrequency(
  record: CaseRecord,
): "Intermittent" | "Consistent" | null {
  const corpus = [
    stripDemoMarker(record.issueTitle),
    stripDemoDescriptionBoilerplate(record.issueDescription),
    record.actualBehaviour,
    record.troubleshootingPerformed,
    record.stepsToReproduce,
  ]
    .join("\n")
    .split(/\n+/)
    .map((line) => collapseWhitespace(line))
    .filter(Boolean)
    .filter((line) => !/\bintermittent across\b/i.test(line))
    .filter((line) => !/\bacross channel types?\b/i.test(line))
    .join("\n");

  if (
    /\bintermittent(?:ly)?\b/i.test(corpus) ||
    /\boccur(?:s|red)? sporadically\b/i.test(corpus) ||
    /\bfails? intermittently\b/i.test(corpus)
  ) {
    return "Intermittent";
  }

  if (
    /\balways (?:fails|occurs|reproduces)\b/i.test(corpus) ||
    /\bconsistently (?:fails|occurs|reproduces)\b/i.test(corpus) ||
    /\bevery (?:time|attempt)\b/i.test(corpus)
  ) {
    return "Consistent";
  }

  return null;
}

function classifyDiagnosticEvidenceBody(
  body: string,
  product: string,
): {
  id: string;
  category: "logs" | "api";
  title: string;
  source: string;
  service: string | null;
} {
  const service = product.trim() || null;

  if (looksLikeApiResponseExcerpt(body) && !looksLikeApplicationLogExcerpt(body)) {
    return {
      id: "api-response",
      category: "api",
      title: "API response",
      source: "Support-recorded",
      service,
    };
  }

  if (looksLikeApiResponseExcerpt(body) && looksLikeApplicationLogExcerpt(body)) {
    // Mixed HTTP + log-level content — prefer API response when HTTP status leads.
    if (/^\s*HTTP status:/im.test(body)) {
      return {
        id: "api-response",
        category: "api",
        title: "API response",
        source: "Support-recorded",
        service,
      };
    }
  }

  return {
    id: "application-logs",
    category: "logs",
    title: "Application logs",
    source: "Support-recorded",
    service,
  };
}

/** True when logsErrors contains a diagnostic artefact, not a customer observation. */
function isDiagnosticArtefact(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) {
    return false;
  }
  if (isObservationalCustomerNote(trimmed)) {
    return false;
  }
  return (
    looksLikeApplicationLogExcerpt(trimmed) ||
    looksLikeApiResponseExcerpt(trimmed)
  );
}

/**
 * Customer observations / incompleteness notes that belong in Overview /
 * Actual behaviour — not the Technical evidence rail.
 */
function isObservationalCustomerNote(body: string): boolean {
  const trimmed = body.trim();
  if (/^Customer-provided note:/i.test(trimmed)) {
    return true;
  }
  if (/^Partial customer note:/i.test(trimmed)) {
    return true;
  }
  if (
    /\bNo complete .+ (log package|application logs|webhook) (yet|provided)\b/i.test(
      trimmed,
    ) &&
    !looksLikeApplicationLogExcerpt(trimmed) &&
    !looksLikeApiResponseExcerpt(trimmed)
  ) {
    return true;
  }
  return false;
}

function looksLikeApiResponseExcerpt(body: string): boolean {
  return (
    /\bHTTP status:\s*\d{3}\b/i.test(body) ||
    /\bHTTP\/\d(?:\.\d)?\s+\d{3}\b/i.test(body) ||
    (/\b(GET|POST|PUT|PATCH|DELETE)\s+\S+/i.test(body) &&
      /\b\d{3}\b/.test(body) &&
      /\b(response|request|status)\b/i.test(body))
  );
}

/** True only when the text resembles an actual log excerpt or record. */
function looksLikeApplicationLogExcerpt(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) {
    return false;
  }

  return (
    /\b(ERROR|WARN|INFO|DEBUG|FATAL)\b/.test(trimmed) ||
    /\bException\b/.test(trimmed) ||
    /\bstack trace\b/i.test(trimmed) ||
    /\bat [\w.$]+\([\w./\\-]+:\d+\)/.test(trimmed) ||
    /\d{4}-\d{2}-\d{2}[T ].{0,80}\b(ERROR|WARN|Exception)\b/i.test(trimmed)
  );
}

function extractRequestIdFromBody(body: string): string | null {
  const match =
    /\bRequest ID:\s*([A-Za-z0-9._:-]+)/i.exec(body) ??
    /\bTrace ID:\s*([A-Za-z0-9._:-]+)/i.exec(body) ??
    /\bCorrelation ID:\s*([A-Za-z0-9._:-]+)/i.exec(body);
  const value = match?.[1]?.trim();
  if (!value) {
    return null;
  }
  if (/pending|placeholder|n\/a|none/i.test(value) || value.endsWith("-pending")) {
    return null;
  }
  return value;
}

function extractTimestampFromBody(body: string): string | null {
  const labelled = /\bTimestamp:\s*([^\n]+)/i.exec(body);
  if (labelled?.[1]) {
    return collapseWhitespace(labelled[1]);
  }
  const iso = /\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\b/.exec(
    body,
  );
  return iso?.[1] ?? null;
}

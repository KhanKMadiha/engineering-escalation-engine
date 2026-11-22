/**
 * Demo-only simulated downstream integrations (Jira / Rootly).
 *
 * Builders prepare preview payloads only from approved handoff + case context.
 * Persistence is handled by createDemoDownstreamRecord (Phase 2B) — never
 * calls external Jira or Rootly APIs. Never invents root cause, traffic, or status.
 */

import { stripDemoMarkersForDisplay } from "@/lib/demo/demo-cases";
import { formatDateTime } from "@/lib/format";
import { supportReproducibilityLabel } from "@/lib/ui/investigation-summary";
import type { EscalationHandoff, Severity } from "@/types";

const NOT_PROVIDED = "Not provided";
const NOT_RECORDED = "Not recorded";

export type DemoJiraPreview = {
  project: string;
  /** Presentation type — never asserts a confirmed Bug without support. */
  issueType: string;
  priority: string;
  summary: string;
  customer: string;
  affectedCustomers: string;
  product: string;
  environment: string;
  /** Meaningful problem summary — not Expected/Actual alone. */
  description: string;
  expectedBehaviour: string;
  actualBehaviour: string;
  /** Steps when Support verified reproduction; otherwise Not recorded. */
  reproductionSteps: string | null;
  reproductionResult: string;
  troubleshooting: string;
  workaround: string;
  evidence: string[];
};

export type DemoJiraResult = {
  kind: "jira_demo";
  demo: true;
  simulated: true;
  key: string;
  priority: string;
  type: string;
  preview: DemoJiraPreview;
};

export type DemoRootlyPreview = {
  incidentId: string;
  title: string;
  severity: string;
  affectedService: string;
  customerImpact: string;
  /** ISO/display start time when recorded on the case; otherwise null. */
  issueStartTime: string | null;
  currentSituation: string;
  investigationFindings: string;
  evidence: string[];
  responseTeam: string | null;
};

export type DemoRootlyResult = {
  kind: "rootly_demo";
  demo: true;
  simulated: true;
  id: string;
  severity: string;
  preview: DemoRootlyPreview;
};

export type DownstreamDemoOptions = {
  product?: string | null;
  customer?: string | null;
  incidentTimestamp?: string | null;
};

/** Presentation-only severity → Jira priority mapping. */
export function severityToJiraPriority(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "Highest";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
  }
}

export function stableDemoNumber(
  seed: string,
  salt: string,
  digits: number,
): string {
  const input = `${seed}:${salt}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const mod = 10 ** digits;
  const value = hash >>> 0;
  return String(value % mod).padStart(digits, "0");
}

export function buildDemoJiraKey(caseId: string, handoffId: string): string {
  return `ENG-DEMO-${stableDemoNumber(`${caseId}:${handoffId}`, "jira", 4)}`;
}

export function buildDemoRootlyId(caseId: string, handoffId: string): string {
  return `INC-DEMO-${stableDemoNumber(`${caseId}:${handoffId}`, "rootly", 3)}`;
}

function displayOrPlaceholder(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    return NOT_PROVIDED;
  }
  return stripDemoMarkersForDisplay(trimmed);
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function affectedCustomersLabel(count: number | null): string {
  if (count === null) {
    return NOT_RECORDED;
  }
  return String(count);
}

function evidenceLines(handoff: EscalationHandoff): string[] {
  if (handoff.evidence.length === 0) {
    return [];
  }
  return handoff.evidence.map((item) => {
    const description = collapse(item.description);
    const excerpt = collapse(item.quotedExcerpt);
    if (description && excerpt) {
      return `${description}: ${excerpt}`;
    }
    return description || excerpt;
  }).filter(Boolean);
}

function firstLines(value: string, max = 4): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max)
    .join("\n");
}

/**
 * Prefer diagnostic artefacts (error response, request ID, gateway/latency)
 * and drop near-duplicate lines for the prominent list. Full list retained
 * for disclosure — nothing is deleted from the underlying collection.
 */
export function selectProminentEvidence(
  evidence: string[],
  max = 3,
): { prominent: string[]; remaining: string[] } {
  const score = (line: string) => {
    if (/HTTP status:\s*\d{3}/i.test(line)) return 6;
    if (/request ID|req-/i.test(line)) return 5;
    if (/Gateway Timeout|upstream|latency|Signature validation/i.test(line)) {
      return 4;
    }
    if (/Error:/i.test(line)) return 3;
    if (/Reproduced|reproduction/i.test(line)) return 2;
    return 1;
  };

  const fingerprint = (line: string) => {
    const excerpt = line.includes(":")
      ? line.slice(line.indexOf(":") + 1)
      : line;
    return excerpt.replace(/\s+/g, " ").trim().toLowerCase();
  };

  const ranked = [...evidence].sort((a, b) => score(b) - score(a));
  const prominent: string[] = [];
  const seen = new Set<string>();

  for (const line of ranked) {
    if (prominent.length >= max) {
      break;
    }
    const key = fingerprint(line);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    prominent.push(line);
  }

  const remaining = evidence.filter((line) => !prominent.includes(line));
  return { prominent, remaining };
}

function buildIssueDescription(handoff: EscalationHandoff): string {
  const summary = collapse(stripDemoMarkersForDisplay(handoff.summary));
  const actual = collapse(stripDemoMarkersForDisplay(handoff.actualBehaviour));
  // Prefer a short problem narrative; fall back to actual behaviour.
  // Avoid dumping the full AI/engine summary chrome when actual is clearer.
  if (actual && actual !== NOT_PROVIDED) {
    const title = collapse(stripDemoMarkersForDisplay(handoff.title));
    if (title && !actual.toLowerCase().includes(title.toLowerCase().slice(0, 24))) {
      return `${title}. ${actual}`;
    }
    return actual;
  }
  if (summary && summary !== NOT_PROVIDED) {
    // Strip common handoff chrome lines that are not a problem description.
    const cleaned = summary
      .replace(/\bIssue category \(AI inference\):[^.]*\./gi, "")
      .replace(/\bEscalation Engine score[^.]+\./gi, "")
      .replace(/\bHuman decision:[^.]*\./gi, "")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned || summary;
  }
  return NOT_PROVIDED;
}

function reproductionStepsIfVerified(handoff: EscalationHandoff): string | null {
  const result = supportReproducibilityLabel(handoff.reproducibility);
  const steps = displayOrPlaceholder(handoff.stepsToReproduce);
  if (steps === NOT_PROVIDED) {
    return null;
  }
  if (result === "Reproduced" || result === "Intermittently reproducible") {
    return steps;
  }
  return null;
}

/**
 * Builds a Jira Engineering investigation preview from approved handoff data.
 */
export function createDemoJiraEscalation(
  handoff: EscalationHandoff,
  options: DownstreamDemoOptions = {},
): DemoJiraResult {
  const key = buildDemoJiraKey(handoff.caseId, handoff.id);
  const priority = severityToJiraPriority(handoff.reportedSeverity);
  const type = "Engineering investigation";
  const product = displayOrPlaceholder(options.product ?? "");
  const customer = displayOrPlaceholder(options.customer ?? "");

  return {
    kind: "jira_demo",
    demo: true,
    simulated: true,
    key,
    priority,
    type,
    preview: {
      project: "Engineering",
      issueType: type,
      priority,
      summary: displayOrPlaceholder(handoff.title),
      customer,
      affectedCustomers: affectedCustomersLabel(handoff.affectedCustomerCount),
      product,
      environment: displayOrPlaceholder(handoff.environment),
      description: buildIssueDescription(handoff),
      expectedBehaviour: displayOrPlaceholder(handoff.expectedBehaviour),
      actualBehaviour: displayOrPlaceholder(handoff.actualBehaviour),
      reproductionSteps: reproductionStepsIfVerified(handoff),
      reproductionResult: supportReproducibilityLabel(handoff.reproducibility),
      troubleshooting: displayOrPlaceholder(handoff.troubleshootingPerformed),
      workaround: NOT_RECORDED,
      evidence: evidenceLines(handoff),
    },
  };
}

/**
 * Builds a Rootly incident preview from approved handoff data.
 * Does not invent status, root cause, or traffic conditions.
 */
export function createDemoRootlyIncident(
  handoff: EscalationHandoff,
  _linkedJiraKey?: string | null,
  options: DownstreamDemoOptions = {},
): DemoRootlyResult {
  const id = buildDemoRootlyId(handoff.caseId, handoff.id);
  const product = displayOrPlaceholder(options.product ?? "");
  const startRaw = options.incidentTimestamp?.trim() ?? "";
  const issueStartTime = startRaw ? formatDateTime(startRaw) : null;

  const impactParts: string[] = [];
  const customer = displayOrPlaceholder(options.customer ?? "");
  if (customer !== NOT_PROVIDED) {
    impactParts.push(customer);
  }
  if (handoff.affectedCustomerCount !== null) {
    impactParts.push(
      `${handoff.affectedCustomerCount} affected customer account(s)`,
    );
  }
  const impactNarrative = collapse(
    stripDemoMarkersForDisplay(handoff.actualBehaviour),
  );
  const customerImpact =
    impactParts.length > 0
      ? `${impactParts.join(" · ")}${impactNarrative ? `. ${impactNarrative}` : ""}`
      : displayOrPlaceholder(handoff.customerImpact);

  return {
    kind: "rootly_demo",
    demo: true,
    simulated: true,
    id,
    severity: handoff.reportedSeverity,
    preview: {
      incidentId: id,
      title: displayOrPlaceholder(handoff.title),
      severity: handoff.reportedSeverity,
      affectedService: product === NOT_PROVIDED ? NOT_RECORDED : product,
      customerImpact,
      issueStartTime,
      currentSituation: displayOrPlaceholder(handoff.actualBehaviour),
      investigationFindings: displayOrPlaceholder(
        firstLines(handoff.troubleshootingPerformed, 4),
      ),
      evidence: evidenceLines(handoff),
      responseTeam: null,
    },
  };
}

/** Downstream demo actions require an approved handoff. */
export function canCreateDownstreamDemo(input: {
  decision?: { decision: string } | null;
  handoff?: EscalationHandoff | null;
}): boolean {
  return input.decision?.decision === "approved" && Boolean(input.handoff);
}

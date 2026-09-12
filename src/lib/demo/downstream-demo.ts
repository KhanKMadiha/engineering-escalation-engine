/**
 * Demo-only simulated downstream integrations (Jira / Rootly).
 *
 * - No network requests
 * - No credentials / SDKs
 * - Pure functions derived from approved handoff data
 * - Deterministic demo IDs for reproducible portfolio screenshots
 *
 * Simulated state is intended to be held in UI memory only (resets on refresh).
 * Does not affect scoring, recommendations, decisions, or handoff content.
 */

import { stripDemoMarkersForDisplay } from "@/lib/demo/demo-cases";
import type { EscalationHandoff, Severity } from "@/types";

const NOT_PROVIDED = "Not provided";

export type DemoJiraPreview = {
  project: string;
  issueType: string;
  priority: string;
  summary: string;
  environment: string;
  affectedCustomers: string;
  reproduction: string;
  description: string;
  evidence: string[];
  decision: string;
  decisionRationale: string;
};

export type DemoJiraResult = {
  kind: "jira_demo";
  demo: true;
  simulated: true;
  key: string;
  status: "Open";
  priority: string;
  type: string;
  preview: DemoJiraPreview;
};

export type DemoRootlyPreview = {
  incidentId: string;
  status: string;
  title: string;
  environment: string;
  severity: string;
  affectedCustomers: string;
  impact: string;
  evidence: string[];
  reproducibility: string;
  decisionRationale: string;
  linkedEngineeringEscalation: string | null;
};

export type DemoRootlyResult = {
  kind: "rootly_demo";
  demo: true;
  simulated: true;
  id: string;
  status: "Active";
  severity: string;
  environment: string;
  preview: DemoRootlyPreview;
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

/**
 * Stable unsigned hash → numeric string of fixed width.
 * Deterministic across runs for the same seed.
 */
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

function issueTypeFromCategory(category: string): string {
  const normalized = category.trim().toLowerCase();
  if (normalized === "bug") {
    return "Bug";
  }
  return "Engineering escalation";
}

function evidenceLines(handoff: EscalationHandoff): string[] {
  if (handoff.evidence.length === 0) {
    return [NOT_PROVIDED];
  }
  return handoff.evidence.map(
    (item) => `${item.description}: ${item.quotedExcerpt}`,
  );
}

function affectedCustomersLabel(count: number | null): string {
  if (count === null) {
    return NOT_PROVIDED;
  }
  return String(count);
}

/**
 * Builds a simulated Jira escalation from the approved handoff only.
 * Synchronous, local, no I/O.
 */
export function createDemoJiraEscalation(
  handoff: EscalationHandoff,
): DemoJiraResult {
  const key = buildDemoJiraKey(handoff.caseId, handoff.id);
  const priority = severityToJiraPriority(handoff.reportedSeverity);
  const type = issueTypeFromCategory(handoff.issueCategory);

  const description = [
    stripDemoMarkersForDisplay(handoff.summary),
    "",
    "Expected behaviour:",
    displayOrPlaceholder(handoff.expectedBehaviour),
    "",
    "Actual behaviour:",
    displayOrPlaceholder(handoff.actualBehaviour),
    "",
    "Steps to reproduce:",
    displayOrPlaceholder(handoff.stepsToReproduce),
    "",
    "Troubleshooting:",
    displayOrPlaceholder(handoff.troubleshootingPerformed),
  ].join("\n");

  return {
    kind: "jira_demo",
    demo: true,
    simulated: true,
    key,
    status: "Open",
    priority,
    type,
    preview: {
      project: "Engineering",
      issueType: type,
      priority,
      summary: displayOrPlaceholder(handoff.title),
      environment: displayOrPlaceholder(handoff.environment),
      affectedCustomers: affectedCustomersLabel(handoff.affectedCustomerCount),
      reproduction: displayOrPlaceholder(handoff.reproducibility),
      description,
      evidence: evidenceLines(handoff),
      decision: "Approved for escalation",
      decisionRationale: displayOrPlaceholder(handoff.decisionRationale),
    },
  };
}

/**
 * Builds a simulated Rootly incident from the approved handoff only.
 * Optional local cross-reference to a prior demo Jira key.
 */
export function createDemoRootlyIncident(
  handoff: EscalationHandoff,
  linkedJiraKey?: string | null,
): DemoRootlyResult {
  const id = buildDemoRootlyId(handoff.caseId, handoff.id);

  return {
    kind: "rootly_demo",
    demo: true,
    simulated: true,
    id,
    status: "Active",
    severity: handoff.reportedSeverity,
    environment: displayOrPlaceholder(handoff.environment),
    preview: {
      incidentId: id,
      status: "Active",
      title: displayOrPlaceholder(handoff.title),
      environment: displayOrPlaceholder(handoff.environment),
      severity: handoff.reportedSeverity,
      affectedCustomers: affectedCustomersLabel(handoff.affectedCustomerCount),
      impact: displayOrPlaceholder(handoff.customerImpact),
      evidence: evidenceLines(handoff),
      reproducibility: displayOrPlaceholder(handoff.reproducibility),
      decisionRationale: displayOrPlaceholder(handoff.decisionRationale),
      linkedEngineeringEscalation: linkedJiraKey?.trim()
        ? linkedJiraKey.trim()
        : null,
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

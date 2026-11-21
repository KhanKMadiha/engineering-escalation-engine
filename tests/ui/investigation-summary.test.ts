import { describe, expect, it } from "vitest";
import {
  buildImpactTimeline,
  buildInvestigationNextSteps,
  buildInvestigationOverview,
  buildTechnicalEvidenceItems,
  buildTroubleshootingPerformed,
  correlationReferenceDisplay,
  establishedRootCause,
  establishedWorkaround,
  impactScopeFromCustomerCount,
  parseReproductionSteps,
  reproductionResultDisplay,
  reproductionStatusDisplay,
  splitReproductionSteps,
} from "@/lib/ui/investigation-summary";
import type { CaseRecord, StoredAnalysis } from "@/types";

const analysis: StoredAnalysis = {
  id: "an-1",
  aiResult: {
    assessedSeverity: "high",
    issueCategory: "unknown",
    reproducibility: "intermittent",
    suspectedProductDefect: false,
    reasoning: "Continue investigating.",
    evidenceIdentified: [],
    missingEvidence: [
      "Complete Teams webhook / bot permission logs for a failing public channel",
      "Channel membership and permission differential vs working private channels",
    ],
    recommendedNextSteps: [
      "Compare bot membership and permissions between public and private channels.",
      "Collect webhook and activity logs for a failing public-channel attempt.",
    ],
    suspectedRootCause: null,
    aiEscalationAssessment: "likely_continue",
  },
  validatedEvidence: [],
  rejectedEvidence: [],
  evidenceCompletenessScore: 0.5,
  model: "demo",
  promptVersion: "1",
  createdAt: "2026-09-12T09:15:00.000Z",
};

const teamsCase: CaseRecord = {
  id: "33333333-3333-4333-8333-333333333333",
  customer: "[DEMO] Apex Digital",
  product: "MS Teams Integration",
  severity: "high",
  issueTitle: "[DEMO] MS Teams Auto-Answer fails to respond in public channels",
  issueDescription: [
    "MS Teams Auto-Answer fails to respond in public channels while still working in some private channels.",
    "Investigation is ongoing. Channel permissions or bot membership may still need to be ruled out.",
  ].join("\n"),
  environment: "production",
  stepsToReproduce: [
    "1. Open a public Teams channel where Auto-Answer is expected.",
    "2. Trigger the Auto-Answer flow.",
    "3. Observe that Auto-Answer does not respond.",
    "4. Retry in a private channel where Auto-Answer still responds.",
    "5. Behaviour is intermittent across channel types; controlled reproduction is incomplete.",
  ].join("\n"),
  expectedBehaviour: "Auto-Answer should respond consistently.",
  actualBehaviour:
    "Auto-Answer fails to respond in public channels while continuing to respond in some private channels.",
  troubleshootingPerformed: [
    "Confirmed the issue is reported in public channels.",
    "Compared behaviour with a private channel that still responds.",
    "Asked whether bot permissions differ by channel type.",
    "Requested Teams activity / webhook samples for a failing public-channel attempt.",
    "Troubleshooting is incomplete; configuration and permissions are not fully ruled out.",
  ].join("\n"),
  logsErrors: "Customer-provided note: Auto-Answer timeout in public channel.",
  requestIds: "Partial correlation note: teams-public-ch-pending",
  incidentTimestamp: null,
  issueFirstObserved: "First noticed on 11 Sep 2026 in public channels",
  affectedCustomerCount: 1,
  status: "investigation_continues",
  createdAt: "2026-09-12T09:15:00.000Z",
  updatedAt: "2026-09-12T14:40:00.000Z",
  analysis,
  events: [],
};

describe("investigation presentation helpers", () => {
  it("builds a one-sentence overview without status, causes, or environment", () => {
    const overview = buildInvestigationOverview(teamsCase);
    expect(overview.affectedProduct).toBe("MS Teams Integration");
    expect(overview.summary).toMatch(/MS Teams Auto-Answer/i);
    expect(overview.summary).toMatch(/public channels/i);
    expect(overview.summary).not.toMatch(/production/i);
    expect(overview.summary).not.toMatch(/investigation is ongoing/i);
    expect(overview.summary).not.toMatch(/permissions or bot membership/i);
    expect(overview.summary).not.toBe(teamsCase.actualBehaviour);
  });

  it("builds impact timeline in mockup order without impact scope", () => {
    const impact = buildImpactTimeline(teamsCase);
    expect(impact.rows.map((row) => row.label)).toEqual([
      "Reported",
      "Issue started",
      "Frequency",
      "Affected users",
      "Affected organisations",
    ]);
    const byLabel = Object.fromEntries(
      impact.rows.map((row) => [row.label, row]),
    );
    expect(byLabel["Affected users"]?.value).toBe("Not recorded");
    expect(byLabel["Affected organisations"]?.value).toBe("1");
    expect(byLabel["Issue started"]?.value).toContain("11 Sep 2026");
    expect(byLabel["Last known working"]).toBeUndefined();
    expect(byLabel.Reported?.provenance).toBe("system");
    // Channel-condition notes + AI reproducibility are not frequency evidence.
    expect(byLabel.Frequency).toEqual({
      label: "Frequency",
      value: "Unknown",
      provenance: "not_recorded",
    });
    expect(impact.rows.some((row) => row.label === "Impact scope")).toBe(false);
    expect(impact.rows.some((row) => row.label === "First observed")).toBe(
      false,
    );

    expect(impactScopeFromCustomerCount(3)).toBe("Multiple organisations");
    expect(impactScopeFromCustomerCount(1)).toBe("Single organisation");
    expect(impactScopeFromCustomerCount(null)).toBe("Unknown");
  });

  it("uses explicitly reported frequency language when present", () => {
    const impact = buildImpactTimeline({
      ...teamsCase,
      issueTitle: "[DEMO] Intermittent 500 errors when retrieving articles",
      stepsToReproduce: "1. Call the API\n2. Observe the failure",
      analysis: {
        ...teamsCase.analysis!,
        aiResult: {
          ...teamsCase.analysis!.aiResult,
          reproducibility: "confirmed",
        },
      },
    });
    expect(
      impact.rows.find((row) => row.label === "Frequency"),
    ).toEqual({
      label: "Frequency",
      value: "Intermittent",
      provenance: "customer_support",
    });
  });

  it("lists performed troubleshooting and consolidated next steps", () => {
    expect(buildTroubleshootingPerformed(teamsCase.troubleshootingPerformed)).toEqual(
      [
        "Confirmed the issue is reported in public channels.",
        "Compared behaviour with a private channel that still responds.",
      ],
    );
    const steps = buildInvestigationNextSteps(teamsCase);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.length).toBeLessThanOrEqual(4);
    expect(
      steps.some((step) => /troubleshooting is incomplete/i.test(step)),
    ).toBe(false);
    expect(
      steps.filter((step) => /bot permissions differ/i.test(step)).length,
    ).toBe(1);
    expect(
      steps.filter((step) =>
        /compare bot membership and permissions/i.test(step),
      ).length,
    ).toBe(0);
  });

  it("excludes human-review workflow instructions from Investigation next steps", () => {
    const steps = buildInvestigationNextSteps({
      ...teamsCase,
      analysis: {
        ...teamsCase.analysis!,
        aiResult: {
          ...teamsCase.analysis!.aiResult,
          recommendedNextSteps: [
            "Have a human reviewer approve or reject escalation based on the engine score.",
            "Capture controlled reproduction in a public test channel.",
          ],
          missingEvidence: [],
        },
      },
    });
    expect(
      steps.some((step) => /human reviewer|engine score|approve or reject/i.test(step)),
    ).toBe(false);
    expect(
      steps.some((step) => /controlled reproduction/i.test(step)),
    ).toBe(true);
  });

  it("keeps actionable reproduction steps and does not treat AI frequency as a result", () => {
    const split = splitReproductionSteps(teamsCase.stepsToReproduce);
    expect(split.steps).toHaveLength(4);
    expect(split.steps.some((step) => /intermittent/i.test(step))).toBe(false);
    expect(split.statusNotes).toHaveLength(1);
    expect(parseReproductionSteps(teamsCase.stepsToReproduce)).toEqual(
      split.steps,
    );
    expect(reproductionStatusDisplay(teamsCase)).toEqual({
      label: "Intermittent",
      provenance: "ai_interpretation",
    });
    expect(reproductionResultDisplay(teamsCase.stepsToReproduce)).toBeNull();
  });

  it("surfaces a recorded support reproduction result when present", () => {
    const steps = [
      "1. Open the failing channel.",
      "2. Trigger Auto-Answer.",
      "3. Support successfully reproduced the failure in a public test channel.",
    ].join("\n");
    expect(reproductionResultDisplay(steps)).toEqual({
      label:
        "Support successfully reproduced the failure in a public test channel.",
      provenance: "customer_support",
    });
  });

  it("never treats AI root cause or missing workaround as established", () => {
    expect(establishedRootCause(teamsCase)).toBeNull();
    expect(establishedWorkaround(teamsCase)).toBeNull();
  });

  it("omits observational notes from technical evidence", () => {
    const items = buildTechnicalEvidenceItems(teamsCase);
    expect(items).toHaveLength(0);
  });

  it("renders API response artefacts with request ID and timestamp", () => {
    const items = buildTechnicalEvidenceItems({
      ...teamsCase,
      product: "API v3",
      logsErrors: [
        "HTTP status: 500",
        "Error: Internal Server Error",
        "Request ID: req-demo-48291",
        "Timestamp: 2026-09-08T09:14:32Z",
      ].join("\n"),
      requestIds: "req-demo-48291",
      incidentTimestamp: "2026-09-08T09:14:32.000Z",
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("API response");
    expect(items[0]?.category).toBe("api");
    expect(items[0]?.service).toBe("API v3");
    expect(items[0]?.correlationId).toBe("req-demo-48291");
    expect(items[0]?.timestamp).toContain("2026-09-08");
    expect(items[0]?.source).toBe("Support-recorded");
    expect(items.some((item) => /datadog|postman|customer report/i.test(item.title))).toBe(
      false,
    );
  });

  it("labels log-like excerpts as application logs and attaches genuine IDs", () => {
    const items = buildTechnicalEvidenceItems({
      ...teamsCase,
      logsErrors:
        "2026-09-12T10:00:00Z ERROR AutoAnswerWorker timeout in public channel",
      requestIds: "req-abc-123",
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Application logs");
    expect(items[0]?.category).toBe("logs");
    expect(items[0]?.correlationId).toBe("req-abc-123");
  });

  it("flags placeholder correlation references", () => {
    expect(correlationReferenceDisplay(teamsCase.requestIds)).toEqual({
      value: "teams-public-ch-pending",
      isPlaceholder: true,
    });
  });
});

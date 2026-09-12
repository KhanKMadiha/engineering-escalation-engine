import type { CaseAnalysisResult } from "@/lib/analysis/analysis-schema";
import type { CreateCaseInput, HumanDecisionType } from "@/types";

/**
 * Fictional demo marker embedded in customer-facing intake fields.
 * Not a domain column — keeps production schema unchanged.
 * Used to identify demo cases; strip for UI presentation only.
 */
export const DEMO_CASE_MARKER = "[DEMO]";

/** Legacy / seed boilerplate previously prepended to issue descriptions. */
export const DEMO_DESCRIPTION_NOTICE =
  `${DEMO_CASE_MARKER} Fictional demonstration scenario — not a real customer incident.`;

/**
 * Removes leading [DEMO] marker for display. Does not alter stored data.
 */
export function stripDemoMarkerPrefix(value: string): string {
  return value.replace(/^\[DEMO\]\s*/i, "");
}

/**
 * Removes demo description boilerplate for display (presentation only).
 */
export function stripDemoDescriptionBoilerplate(value: string): string {
  return value
    .replace(
      /^\[DEMO\]\s*Fictional demonstration scenario — not a real customer incident\.\s*/im,
      "",
    )
    .replace(/^\n+/, "")
    .trimEnd();
}

/**
 * Strips all [DEMO] presentation markers from a displayed string.
 * Does not alter stored case/handoff data.
 */
export function stripDemoMarkersForDisplay(value: string): string {
  return stripDemoDescriptionBoilerplate(value).replace(/\[DEMO\]\s*/gi, "");
}

export type DemoCaseKey =
  | "clear_escalation"
  | "continue_investigation"
  | "insufficient_evidence";

/**
 * Optional post-analysis human decision applied through DecisionService during seed.
 * Uses real workflow transitions (approve → escalated + handoff; reject → investigation_continues).
 */
export type DemoSeedDecision = {
  decision: HumanDecisionType;
  rationale: string;
  /** Fixed ISO timestamp for decidedAt / handoff createdAt (rewritten after DecisionService). */
  decidedAt: string;
};

export type DemoCaseDefinition = {
  key: DemoCaseKey;
  label: string;
  /** Expected Escalation Engine recommendation after analysis (for tests/docs). */
  expectedRecommendation:
    | "escalate"
    | "continue_investigation"
    | "insufficient_evidence";
  /**
   * Expected workflow status after seed completes (including optional decision).
   * Must be reachable via existing CaseOrchestrator / DecisionService paths.
   */
  expectedStatus:
    | "awaiting_decision"
    | "escalated"
    | "investigation_continues";
  /**
   * Fixed case reported / createdAt (ISO). Deterministic for screenshots and tests.
   * Must be on/after any precise incidentTimestamp on the case.
   */
  reportedAt: string;
  /** When set, seed records this decision via DecisionService after analysis. */
  seedDecision?: DemoSeedDecision;
  createInput: CreateCaseInput;
  /**
   * Deterministic structured AI payload for the demo analysis client.
   * Excerpts must appear verbatim in createInput fields (evidence validation).
   */
  analysisPayload: CaseAnalysisResult;
};

/**
 * Three fictional Support Ops scenarios at different lifecycle stages.
 * Outcomes use existing deterministic rules and DecisionService — no domain bypass.
 *
 * A — Northstar Financial / API v3 → escalate → human approve → escalated (8 Sep 2026)
 * B — Meridian Systems / SSO → insufficient_evidence → awaiting_decision (11 Sep 2026)
 * C — Apex Digital / MS Teams → continue_investigation → human reject →
 *     investigation_continues (12 Sep 2026)
 *
 * Note: there is no `investigating` CaseStatus. `investigation_continues` is the
 * closest valid state after a human records that escalation should not proceed yet.
 */
export const DEMO_CASE_DEFINITIONS: readonly DemoCaseDefinition[] = [
  {
    key: "clear_escalation",
    label: "API platform escalation",
    expectedRecommendation: "escalate",
    expectedStatus: "escalated",
    reportedAt: "2026-09-08T11:30:00.000Z",
    seedDecision: {
      decision: "approved",
      rationale:
        "Production API failures reproduced across multiple affected customers with validated request IDs and logs. Escalation to engineering is warranted.",
      decidedAt: "2026-09-08T16:15:00.000Z",
    },
    createInput: {
      customer: `${DEMO_CASE_MARKER} Northstar Financial`,
      product: "API v3",
      severity: "high",
      issueTitle: `${DEMO_CASE_MARKER} Intermittent 500 errors when retrieving articles through API v3`,
      issueDescription: [
        "Multiple enterprise customers are intermittently unable to retrieve articles through the API.",
        "Failed responses include HTTP status: 500, Error: Internal Server Error.",
        "Request ID: req-demo-48291",
        "Timestamp: 2026-09-08T09:14:32Z",
      ].join("\n"),
      environment: "production",
      stepsToReproduce: [
        "1. Authenticate using a valid enterprise API credential.",
        "2. Send a GET request to the API v3 article endpoint.",
        "3. Repeat the request across several article IDs.",
        "4. Observe that some requests intermittently return HTTP 500.",
        "5. Retry the same request.",
        "6. Observe that the request may subsequently succeed.",
      ].join("\n"),
      expectedBehaviour:
        "A valid article request should consistently return the requested article with HTTP 200.",
      actualBehaviour:
        "Some requests intermittently return HTTP 500 despite valid authentication and otherwise successful requests.",
      troubleshootingPerformed: [
        "Reproduced the issue in production.",
        "Tested multiple article IDs.",
        "Confirmed authentication succeeds.",
        "Retried failed requests.",
        "Observed intermittent rather than consistently failing behaviour.",
        "Compared successful and failed requests.",
      ].join("\n"),
      logsErrors: [
        "HTTP status: 500",
        "Error: Internal Server Error",
        "Request ID: req-demo-48291",
        "Timestamp: 2026-09-08T09:14:32Z",
      ].join("\n"),
      requestIds: "req-demo-48291",
      incidentTimestamp: "2026-09-08T09:14:32.000Z",
      issueFirstObserved: "Around 08:00 on 8 Sep 2026",
      affectedCustomerCount: 3,
    },
    analysisPayload: {
      assessedSeverity: "high",
      issueCategory: "bug",
      reproducibility: "confirmed",
      suspectedProductDefect: true,
      reasoning:
        "Customer-provided production logs and request ID show intermittent HTTP 500 responses on article retrieval. Support reproduced the issue. Advisory assessment only — human approval still required for escalation.",
      evidenceIdentified: [
        {
          description: "HTTP 500 status in provided logs",
          sourceField: "logsErrors",
          quotedExcerpt: "HTTP status: 500",
        },
        {
          description: "Internal server error message",
          sourceField: "logsErrors",
          quotedExcerpt: "Error: Internal Server Error",
        },
        {
          description: "Demo request ID from logs",
          sourceField: "logsErrors",
          quotedExcerpt: "Request ID: req-demo-48291",
        },
        {
          description: "Request ID field",
          sourceField: "requestIds",
          quotedExcerpt: "req-demo-48291",
        },
        {
          description: "Intermittent 500 in actual behaviour",
          sourceField: "actualBehaviour",
          quotedExcerpt: "intermittently return HTTP 500",
        },
        {
          description: "Reproduction step observing 500",
          sourceField: "stepsToReproduce",
          quotedExcerpt: "intermittently return HTTP 500",
        },
        {
          description: "Production reproduction note",
          sourceField: "troubleshootingPerformed",
          quotedExcerpt: "Reproduced the issue in production.",
        },
        {
          description: "Expected consistent HTTP 200",
          sourceField: "expectedBehaviour",
          quotedExcerpt: "HTTP 200",
        },
      ],
      missingEvidence: [],
      recommendedNextSteps: [
        "Have a human reviewer approve or reject escalation based on the engine score.",
      ],
      suspectedRootCause:
        "Intermittent server-side failure on API v3 article retrieval (inference from customer evidence; not proven).",
      aiEscalationAssessment: "likely_escalate",
    },
  },
  {
    key: "insufficient_evidence",
    label: "SSO incomplete evidence",
    expectedRecommendation: "insufficient_evidence",
    expectedStatus: "awaiting_decision",
    reportedAt: "2026-09-11T10:20:00.000Z",
    createInput: {
      customer: `${DEMO_CASE_MARKER} Meridian Systems`,
      product: "SSO",
      severity: "medium",
      issueTitle: `${DEMO_CASE_MARKER} SSO authentication fails after identity provider certificate rotation`,
      issueDescription: [
        "SSO authentication began failing for some users after an identity provider certificate rotation.",
        "Customer suspects the rotation or related IdP configuration, but has not confirmed whether this is a configuration issue or a product defect.",
        "Investigation has started; evidence remains incomplete.",
      ].join("\n"),
      environment: "production",
      stepsToReproduce: [
        "1. Attempt SSO login with an affected user account.",
        "2. Observe authentication failure after the IdP certificate rotation.",
        "3. Compare with a user who can still authenticate.",
        "4. Support has not yet captured a complete SAML failure package.",
      ].join("\n"),
      expectedBehaviour:
        "SSO authentication should succeed for authorised users after a valid IdP certificate rotation.",
      actualBehaviour:
        "SSO authentication fails for some users after the identity provider certificate rotation.",
      troubleshootingPerformed: [
        "Confirmed the customer recently rotated the IdP signing certificate.",
        "Asked for the rotation window and affected user samples.",
        "Requested SAML response / assertion for a failing login.",
        "Configuration versus product defect is not yet established.",
      ].join("\n"),
      logsErrors:
        "Partial customer note: SSO authentication failed after certificate rotation. No complete application logs provided.",
      requestIds: "No correlation ID provided for failing SSO attempts.",
      incidentTimestamp: null,
      issueFirstObserved: "After IdP certificate rotation on 10 Sep 2026",
      affectedCustomerCount: 1,
    },
    analysisPayload: {
      assessedSeverity: "medium",
      issueCategory: "configuration",
      reproducibility: "not_reproduced",
      suspectedProductDefect: false,
      reasoning:
        "Medium-severity production SSO report after IdP certificate rotation. Configuration involvement is likely and evidence (SAML package, correlation IDs, controlled reproduction) is incomplete, so engineering escalation is not yet justified.",
      evidenceIdentified: [
        {
          description: "Failures after certificate rotation",
          sourceField: "actualBehaviour",
          quotedExcerpt: "after the identity provider certificate rotation",
        },
        {
          description: "Customer rotated IdP certificate",
          sourceField: "troubleshootingPerformed",
          quotedExcerpt: "rotated the IdP signing certificate",
        },
        {
          description: "Partial SSO failure note",
          sourceField: "logsErrors",
          quotedExcerpt: "SSO authentication failed after certificate rotation",
        },
      ],
      missingEvidence: [
        "Complete SAML response / assertion for a failing login",
        "Application correlation IDs for failing SSO attempts",
        "Confirmed IdP certificate metadata and trust-store configuration",
        "Controlled reproduction with before/after rotation comparison",
      ],
      recommendedNextSteps: [
        "Collect a full SAML failure package from an affected login.",
        "Verify IdP certificate trust configuration on both sides.",
        "Obtain application correlation IDs for failing authentication attempts.",
      ],
      suspectedRootCause:
        "Possible IdP certificate / trust configuration issue after rotation (unconfirmed; insufficient evidence).",
      aiEscalationAssessment: "insufficient_data",
    },
  },
  {
    key: "continue_investigation",
    label: "MS Teams active investigation",
    expectedRecommendation: "continue_investigation",
    expectedStatus: "investigation_continues",
    reportedAt: "2026-09-12T09:15:00.000Z",
    seedDecision: {
      decision: "rejected",
      rationale:
        "Further channel permission and configuration checks are required before engineering escalation.",
      decidedAt: "2026-09-12T14:40:00.000Z",
    },
    createInput: {
      customer: `${DEMO_CASE_MARKER} Apex Digital`,
      product: "MS Teams Integration",
      severity: "high",
      issueTitle: `${DEMO_CASE_MARKER} MS Teams Auto-Answer fails to respond in public channels`,
      issueDescription: [
        "MS Teams Auto-Answer fails to respond in public channels while still working in some private channels.",
        "Investigation is ongoing. Channel permissions or bot membership may still need to be ruled out.",
        "Engineering escalation would be premature until configuration and permissions are checked.",
      ].join("\n"),
      environment: "production",
      stepsToReproduce: [
        "1. Open a public Teams channel where Auto-Answer is expected.",
        "2. Trigger the Auto-Answer flow.",
        "3. Observe that Auto-Answer does not respond.",
        "4. Retry in a private channel where Auto-Answer still responds.",
        "5. Behaviour is intermittent across channel types; controlled reproduction is incomplete.",
      ].join("\n"),
      expectedBehaviour:
        "Auto-Answer should respond consistently in configured public and private Microsoft Teams channels.",
      actualBehaviour:
        "Auto-Answer fails to respond in public channels while continuing to respond in some private channels.",
      troubleshootingPerformed: [
        "Confirmed the issue is reported in public channels.",
        "Compared behaviour with a private channel that still responds.",
        "Asked whether bot permissions differ by channel type.",
        "Requested Teams activity / webhook samples for a failing public-channel attempt.",
        "Troubleshooting is incomplete; configuration and permissions are not fully ruled out.",
      ].join("\n"),
      logsErrors: [
        "Customer-provided note: Auto-Answer timeout in public channel.",
        "No complete webhook or bot-permission log package yet.",
      ].join("\n"),
      requestIds: "Partial correlation note: teams-public-ch-pending",
      incidentTimestamp: null,
      issueFirstObserved: "First noticed on 11 Sep 2026 in public channels",
      affectedCustomerCount: 1,
    },
    analysisPayload: {
      assessedSeverity: "high",
      issueCategory: "unknown",
      reproducibility: "intermittent",
      suspectedProductDefect: false,
      reasoning:
        "High-severity MS Teams Integration report with intermittent public-channel Auto-Answer failures. Configuration/permissions are not ruled out and troubleshooting is incomplete, so continued investigation is appropriate before escalation.",
      evidenceIdentified: [
        {
          description: "Public channel Auto-Answer failures",
          sourceField: "actualBehaviour",
          quotedExcerpt: "fails to respond in public channels",
        },
        {
          description: "Incomplete troubleshooting",
          sourceField: "troubleshootingPerformed",
          quotedExcerpt: "Troubleshooting is incomplete",
        },
        {
          description: "Partial Auto-Answer timeout note",
          sourceField: "logsErrors",
          quotedExcerpt: "Auto-Answer timeout in public channel",
        },
      ],
      missingEvidence: [
        "Complete Teams webhook / bot permission logs for a failing public channel",
        "Channel membership and permission differential vs working private channels",
        "Reliable controlled reproduction across channel types",
      ],
      recommendedNextSteps: [
        "Compare bot membership and permissions between public and private channels.",
        "Collect webhook and activity logs for a failing public-channel attempt.",
        "Reproduce Auto-Answer failure in a controlled public test channel.",
      ],
      suspectedRootCause: null,
      aiEscalationAssessment: "likely_continue",
    },
  },
] as const;

/**
 * Prior fictional customer labels used in older demo seeds.
 * Kept only so clear/reseed tooling can recognise leftover placeholder rows.
 * Not used as live seed data.
 */
export const LEGACY_DEMO_CUSTOMER_NAMES = [
  "Example Enterprise A",
  "Example Enterprise B",
  "Example Enterprise C",
] as const;

export function isDemoCaseTitle(issueTitle: string): boolean {
  return issueTitle.includes(DEMO_CASE_MARKER);
}

/** True when a stored customer still uses a retired demo placeholder name. */
export function isLegacyDemoCustomerName(customer: string): boolean {
  const stripped = customer.replace(DEMO_CASE_MARKER, "").trim();
  return (LEGACY_DEMO_CUSTOMER_NAMES as readonly string[]).includes(stripped);
}

export function findDemoDefinitionByTitle(
  issueTitle: string,
): DemoCaseDefinition | undefined {
  return DEMO_CASE_DEFINITIONS.find((d) => d.createInput.issueTitle === issueTitle);
}

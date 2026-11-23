import type { DemoCaseDefinition } from "@/lib/demo/demo-cases";

/** Matches DEMO_CASE_MARKER — duplicated to avoid a runtime circular import. */
const DEMO = "[DEMO]";

/**
 * Seven additional fictional demo scenarios (Jan–Nov 2026).
 * Outcomes use the real Escalation Engine + DecisionService — scores are not hardcoded.
 *
 * Keys must stay unique and stable for idempotent seed-by-title.
 */
export const ADDITIONAL_DEMO_CASE_DEFINITIONS: readonly DemoCaseDefinition[] = [
  {
    key: "search_indexing",
    label: "Enterprise search indexing",
    expectedRecommendation: "escalate",
    expectedStatus: "escalated",
    reportedAt: "2026-01-22T15:40:00.000Z",
    seedDecision: {
      decision: "approved",
      rationale:
        "Production search index lag reproduced with request IDs and Datadog-style service logs. Engineering escalation is warranted.",
      decidedAt: "2026-01-23T11:05:00.000Z",
    },
    createInput: {
      customer: `${DEMO} Helix Analytics`,
      product: "Enterprise Search",
      severity: "critical",
      issueTitle: `${DEMO} New articles not appearing in Enterprise Search`,
      issueDescription:
        "New articles stay missing from Enterprise Search for hours after publish. Indexer logs show failures (req-demo-search-1182).",
      environment: "production",
      stepsToReproduce: [
        "1. Publish a new article in the knowledge base.",
        "2. Wait for the normal indexing window (under 5 minutes).",
        "3. Search for the article title in Enterprise Search.",
        "4. Observe that the article is missing from results.",
        "5. Repeat with a second article; same delay/failure pattern.",
      ].join("\n"),
      expectedBehaviour:
        "Newly published articles should appear in Enterprise Search within the documented indexing window.",
      actualBehaviour:
        "Newly published articles remain missing from search results for hours after publish.",
      troubleshootingPerformed: [
        "Reproduced the issue in production.",
        "Confirmed publish succeeds and the article is visible in the authoring UI.",
        "Collected indexer worker failure logs with request IDs.",
        "Compared a successful historical index job with a failing job.",
        "Ruled out customer-side ACL filters for the test articles.",
      ].join("\n"),
      logsErrors: [
        "HTTP status: 500",
        "Error: IndexerWorkerException: failed to upsert document",
        "Request ID: req-demo-search-1182",
        "Timestamp: 2026-01-22T09:18:44Z",
      ].join("\n"),
      requestIds: "req-demo-search-1182",
      incidentTimestamp: "2026-01-22T09:18:44.000Z",
      issueFirstObserved: "Morning of 21 Jan 2026",
      affectedCustomerCount: 4,
    },
    analysisPayload: {
      assessedSeverity: "critical",
      issueCategory: "bug",
      reproducibility: "confirmed",
      suspectedProductDefect: true,
      reasoning:
        "Critical production indexing failures with validated request IDs and worker errors. Support reproduced missing search results after publish. Advisory only — human approval still required.",
      evidenceIdentified: [
        {
          description: "Indexer 500 in logs",
          sourceField: "logsErrors",
          quotedExcerpt: "HTTP status: 500",
        },
        {
          description: "Indexer worker exception",
          sourceField: "logsErrors",
          quotedExcerpt: "IndexerWorkerException: failed to upsert document",
        },
        {
          description: "Search request ID",
          sourceField: "requestIds",
          quotedExcerpt: "req-demo-search-1182",
        },
        {
          description: "Missing from results",
          sourceField: "actualBehaviour",
          quotedExcerpt: "missing from search results",
        },
        {
          description: "Production reproduction",
          sourceField: "troubleshootingPerformed",
          quotedExcerpt: "Reproduced the issue in production.",
        },
        {
          description: "Expected indexing window",
          sourceField: "expectedBehaviour",
          quotedExcerpt: "within the documented indexing window",
        },
        {
          description: "Reproduction observes missing article",
          sourceField: "stepsToReproduce",
          quotedExcerpt: "article is missing from results",
        },
        {
          description: "Issue description notes indexer failures",
          sourceField: "issueDescription",
          quotedExcerpt: "req-demo-search-1182",
        },
      ],
      missingEvidence: [],
      recommendedNextSteps: [
        "Have a human reviewer approve or reject escalation based on the engine score.",
      ],
      suspectedRootCause:
        "Indexer worker upsert failures preventing newly published documents from entering the search index (inference; not proven).",
      aiEscalationAssessment: "likely_escalate",
    },
  },
  {
    key: "slack_notifications",
    label: "Slack notification failures",
    expectedRecommendation: "escalate",
    expectedStatus: "escalated",
    reportedAt: "2026-03-18T13:10:00.000Z",
    seedDecision: {
      decision: "approved",
      rationale:
        "Slack outbound notifications fail with consistent webhook errors across channels. Escalation approved.",
      decidedAt: "2026-03-18T17:45:00.000Z",
    },
    createInput: {
      customer: `${DEMO} Cascade Retail`,
      product: "Slack Integration",
      severity: "high",
      issueTitle: `${DEMO} Slack channel notifications not delivering`,
      issueDescription:
        "Slack notifications are not reaching configured channels. Delivery logs show HTTP 500 slack_delivery_failed (req-demo-slack-7741).",
      environment: "production",
      stepsToReproduce: [
        "1. Trigger an alert that should notify a configured Slack channel.",
        "2. Observe that no message appears in Slack.",
        "3. Inspect delivery logs for the notification attempt.",
        "4. Confirm the same alert still creates an in-app notification.",
        "5. Retry; Slack delivery continues to fail.",
      ].join("\n"),
      expectedBehaviour:
        "Configured Slack channels should receive outbound notification messages when alerts fire.",
      actualBehaviour:
        "Slack channel notifications fail to deliver while in-app notifications still succeed.",
      troubleshootingPerformed: [
        "Reproduced the issue in production.",
        "Verified Slack workspace connection still shows as connected.",
        "Collected webhook delivery failure logs with request IDs.",
        "Confirmed channel IDs match the configured destinations.",
        "Retried failed deliveries; failures persisted.",
      ].join("\n"),
      logsErrors: [
        "HTTP status: 500",
        "Error: slack_delivery_failed",
        "Request ID: req-demo-slack-7741",
        "Timestamp: 2026-03-18T08:42:11Z",
      ].join("\n"),
      requestIds: "req-demo-slack-7741",
      incidentTimestamp: "2026-03-18T08:42:11.000Z",
      issueFirstObserved: "17 Mar 2026 afternoon",
      affectedCustomerCount: 2,
    },
    analysisPayload: {
      assessedSeverity: "high",
      issueCategory: "bug",
      reproducibility: "confirmed",
      suspectedProductDefect: true,
      reasoning:
        "High-severity production Slack delivery failures with validated webhook errors and request IDs. Support reproduced missing channel messages. Human approval still required.",
      evidenceIdentified: [
        {
          description: "Slack delivery HTTP 500",
          sourceField: "logsErrors",
          quotedExcerpt: "HTTP status: 500",
        },
        {
          description: "slack_delivery_failed error",
          sourceField: "logsErrors",
          quotedExcerpt: "Error: slack_delivery_failed",
        },
        {
          description: "Slack request ID",
          sourceField: "requestIds",
          quotedExcerpt: "req-demo-slack-7741",
        },
        {
          description: "Channel delivery failure",
          sourceField: "actualBehaviour",
          quotedExcerpt: "fail to deliver",
        },
        {
          description: "Production reproduction",
          sourceField: "troubleshootingPerformed",
          quotedExcerpt: "Reproduced the issue in production.",
        },
        {
          description: "Expected Slack delivery",
          sourceField: "expectedBehaviour",
          quotedExcerpt: "receive outbound notification messages",
        },
        {
          description: "Reproduction step",
          sourceField: "stepsToReproduce",
          quotedExcerpt: "no message appears in Slack",
        },
        {
          description: "Description includes webhook failure",
          sourceField: "issueDescription",
          quotedExcerpt: "slack_delivery_failed",
        },
      ],
      missingEvidence: [],
      recommendedNextSteps: [
        "Have a human reviewer approve or reject escalation based on the engine score.",
      ],
      suspectedRootCause:
        "Outbound Slack webhook delivery path failing for configured channels (inference; not proven).",
      aiEscalationAssessment: "likely_escalate",
    },
  },
  {
    key: "scim_provisioning",
    label: "SCIM provisioning incomplete",
    expectedRecommendation: "insufficient_evidence",
    expectedStatus: "investigation_continues",
    reportedAt: "2026-04-09T16:25:00.000Z",
    createInput: {
      customer: `${DEMO} Summit Workforce`,
      product: "SCIM Directory Sync",
      severity: "medium",
      issueTitle: `${DEMO} SCIM not provisioning some new users`,
      issueDescription:
        "Some new IdP users never appear in the product directory after SCIM sync. Complete SCIM request/response pairs not yet available.",
      environment: "production",
      stepsToReproduce: [
        "1. Create a new user in the customer IdP.",
        "2. Wait for the scheduled SCIM sync.",
        "3. Observe that some users never appear in the product directory.",
        "4. Support has not yet captured a complete SCIM PATCH/POST failure package.",
      ].join("\n"),
      expectedBehaviour:
        "New IdP users matching the SCIM filter should be provisioned into the product directory.",
      actualBehaviour:
        "A subset of new hires are never provisioned after SCIM sync completes.",
      troubleshootingPerformed: [
        "Confirmed SCIM connector status shows connected.",
        "Asked for sample user externalIds that failed to provision.",
        "Requested SCIM request/response bodies for a failing create.",
        "Configuration versus product defect is not yet established.",
      ].join("\n"),
      logsErrors:
        "Partial customer note: SCIM provisioning skipped for some users. No complete SCIM request/response package provided.",
      requestIds: "No correlation ID provided for failing SCIM operations.",
      incidentTimestamp: null,
      issueFirstObserved: "Early April 2026 after a hiring surge",
      affectedCustomerCount: 1,
    },
    analysisPayload: {
      assessedSeverity: "medium",
      issueCategory: "configuration",
      reproducibility: "not_reproduced",
      suspectedProductDefect: false,
      reasoning:
        "Medium-severity SCIM provisioning report with incomplete request/response evidence. Configuration involvement is plausible; engineering escalation is not yet justified.",
      evidenceIdentified: [
        {
          description: "Subset never provisioned",
          sourceField: "actualBehaviour",
          quotedExcerpt: "never provisioned after SCIM sync",
        },
        {
          description: "Connector connected",
          sourceField: "troubleshootingPerformed",
          quotedExcerpt: "SCIM connector status shows connected",
        },
        {
          description: "Partial SCIM note",
          sourceField: "logsErrors",
          quotedExcerpt: "SCIM provisioning skipped for some users",
        },
      ],
      missingEvidence: [
        "Complete SCIM request/response for a failing user create",
        "Application correlation IDs for failing SCIM operations",
        "Confirmed attribute mapping and filter configuration",
        "Controlled reproduction with a known test user",
      ],
      recommendedNextSteps: [
        "Collect a full SCIM create/update failure package.",
        "Verify attribute mappings and group filters.",
        "Obtain correlation IDs for failing SCIM operations.",
      ],
      suspectedRootCause:
        "Possible SCIM filter or attribute-mapping misconfiguration (unconfirmed; insufficient evidence).",
      aiEscalationAssessment: "insufficient_data",
    },
  },
  {
    key: "api_rate_limit",
    label: "API rate limiting",
    expectedRecommendation: "continue_investigation",
    expectedStatus: "investigation_continues",
    reportedAt: "2026-05-14T10:05:00.000Z",
    seedDecision: {
      decision: "rejected",
      rationale:
        "HTTP 429 responses may reflect tenant quota configuration. Collect quota headers and client retry behaviour before escalating.",
      decidedAt: "2026-05-14T15:30:00.000Z",
    },
    createInput: {
      customer: `${DEMO} Blue Harbor Logistics`,
      product: "API v3",
      severity: "high",
      issueTitle: `${DEMO} Intermittent HTTP 429 errors from API v3`,
      issueDescription:
        "API clients intermittently receive HTTP 429 in prod. Need to confirm quota headers and client retry/backoff before escalating.",
      environment: "production",
      stepsToReproduce: [
        "1. Authenticate with a valid enterprise API credential.",
        "2. Send a burst of GET requests to the API v3 articles endpoint.",
        "3. Observe intermittent HTTP 429 responses.",
        "4. Note Retry-After headers when present.",
        "5. Controlled comparison against a lower-volume client is incomplete.",
      ].join("\n"),
      expectedBehaviour:
        "Authenticated clients within the contracted quota should receive HTTP 200 responses rather than intermittent 429s.",
      actualBehaviour:
        "Clients intermittently receive HTTP 429 rate-limit responses in prod.",
      troubleshootingPerformed: [
        "Confirmed authentication succeeds between failures.",
        "Collected sample 429 responses including rate-limit headers.",
        "Asked whether multiple services share the same API credential.",
        "Requested client-side retry/backoff configuration.",
        "Troubleshooting is incomplete; quota configuration is not fully ruled out.",
      ].join("\n"),
      logsErrors: [
        "HTTP status: 429",
        "Error: rate_limit_exceeded",
        "Request ID: req-demo-429-3301",
        "x-ratelimit-remaining: 0",
      ].join("\n"),
      requestIds: "req-demo-429-3301",
      incidentTimestamp: "2026-05-14T07:55:02.000Z",
      issueFirstObserved: "First noticed on 12 May 2026",
      affectedCustomerCount: 1,
    },
    analysisPayload: {
      assessedSeverity: "high",
      issueCategory: "unknown",
      reproducibility: "intermittent",
      suspectedProductDefect: false,
      reasoning:
        "High-severity production 429 report with intermittent reproduction. Quota/configuration ownership is not ruled out, so continued investigation is appropriate before escalation.",
      evidenceIdentified: [
        {
          description: "HTTP 429 in logs",
          sourceField: "logsErrors",
          quotedExcerpt: "HTTP status: 429",
        },
        {
          description: "rate_limit_exceeded",
          sourceField: "logsErrors",
          quotedExcerpt: "Error: rate_limit_exceeded",
        },
        {
          description: "Request ID for 429",
          sourceField: "requestIds",
          quotedExcerpt: "req-demo-429-3301",
        },
        {
          description: "Intermittent 429 behaviour",
          sourceField: "actualBehaviour",
          quotedExcerpt: "intermittently receive HTTP 429",
        },
        {
          description: "Incomplete troubleshooting",
          sourceField: "troubleshootingPerformed",
          quotedExcerpt: "Troubleshooting is incomplete",
        },
      ],
      missingEvidence: [
        "Confirmed contracted quota versus observed rate-limit headers",
        "Client retry/backoff configuration details",
        "Whether multiple services share one credential",
      ],
      recommendedNextSteps: [
        "Compare rate-limit headers with the contracted tenant quota.",
        "Validate client retry/backoff behaviour.",
        "Determine whether multiple services share the same API credential.",
      ],
      suspectedRootCause: null,
      aiEscalationAssessment: "likely_continue",
    },
  },
  {
    key: "saml_subset_users",
    label: "SAML subset auth failures",
    expectedRecommendation: "escalate",
    expectedStatus: "awaiting_decision",
    reportedAt: "2026-06-25T12:50:00.000Z",
    createInput: {
      customer: `${DEMO} Orchid Health`,
      product: "SSO",
      severity: "high",
      issueTitle: `${DEMO} SAML SSO failing for some users`,
      issueDescription:
        "Some users fail SAML SSO while peers on the same IdP succeed. Captured error: Signature validation failed (req-demo-saml-5520).",
      environment: "production",
      stepsToReproduce: [
        "1. Attempt SSO login with an affected user account.",
        "2. Observe authentication failure after assertion POST.",
        "3. Capture the SAMLResponse for the failing login.",
        "4. Compare with a peer user in the same IdP who can authenticate.",
        "5. Confirm the failure reproduces for the affected cohort.",
      ].join("\n"),
      expectedBehaviour:
        "Authorised enterprise users in the same IdP should complete SAML SSO successfully.",
      actualBehaviour:
        "A subset of users fail SAML authentication with signature validation errors while peers succeed.",
      troubleshootingPerformed: [
        "Reproduced the issue in production with an affected test user.",
        "Collected SAMLResponse excerpts showing Signature validation failed.",
        "Compared successful and failing assertions from the same IdP.",
        "Verified IdP entity ID and ACS URL match the configured connection.",
        "Confirmed the failure is limited to a known user cohort.",
      ].join("\n"),
      logsErrors: [
        "HTTP status: 401",
        "Error: Signature validation failed",
        "Request ID: req-demo-saml-5520",
        "Timestamp: 2026-06-25T09:05:33Z",
      ].join("\n"),
      requestIds: "req-demo-saml-5520",
      incidentTimestamp: "2026-06-25T09:05:33.000Z",
      issueFirstObserved: "24 Jun 2026 for users in OU=Contractors",
      affectedCustomerCount: 1,
    },
    analysisPayload: {
      assessedSeverity: "high",
      issueCategory: "bug",
      reproducibility: "confirmed",
      suspectedProductDefect: true,
      reasoning:
        "High-severity production SAML failures for a user subset with validated signature errors and request IDs. Support reproduced the failing cohort. Human approval still required.",
      evidenceIdentified: [
        {
          description: "HTTP 401 in logs",
          sourceField: "logsErrors",
          quotedExcerpt: "HTTP status: 401",
        },
        {
          description: "Signature validation failed",
          sourceField: "logsErrors",
          quotedExcerpt: "Error: Signature validation failed",
        },
        {
          description: "SAML request ID",
          sourceField: "requestIds",
          quotedExcerpt: "req-demo-saml-5520",
        },
        {
          description: "Subset fails while peers succeed",
          sourceField: "actualBehaviour",
          quotedExcerpt: "signature validation errors while peers succeed",
        },
        {
          description: "Production reproduction",
          sourceField: "troubleshootingPerformed",
          quotedExcerpt: "Reproduced the issue in production",
        },
        {
          description: "Expected SSO success",
          sourceField: "expectedBehaviour",
          quotedExcerpt: "complete SAML SSO successfully",
        },
        {
          description: "Reproduction captures SAMLResponse",
          sourceField: "stepsToReproduce",
          quotedExcerpt: "Capture the SAMLResponse",
        },
        {
          description: "Description notes Signature validation failed",
          sourceField: "issueDescription",
          quotedExcerpt: "Signature validation failed",
        },
      ],
      missingEvidence: [],
      recommendedNextSteps: [
        "Have a human reviewer approve or reject escalation based on the engine score.",
      ],
      suspectedRootCause:
        "SAML assertion signature validation failing for a user cohort (inference; not proven).",
      aiEscalationAssessment: "likely_escalate",
    },
  },
  {
    key: "email_delivery",
    label: "Email notification delivery",
    expectedRecommendation: "continue_investigation",
    expectedStatus: "investigation_continues",
    reportedAt: "2026-08-06T14:20:00.000Z",
    seedDecision: {
      decision: "rejected",
      rationale:
        "Email delivery failures may involve ESP reputation or recipient filtering. Collect provider bounce codes before escalating.",
      decidedAt: "2026-08-07T09:55:00.000Z",
    },
    createInput: {
      customer: `${DEMO} Brightline Insurance`,
      product: "Email Notifications",
      severity: "high",
      issueTitle: `${DEMO} Password-reset emails intermittently not delivering`,
      issueDescription:
        "Password-reset and security emails are intermittently not being delivered. Some SMTP deferrals have been identified, but we're still waiting for complete bounce logs.",
      environment: "production",
      stepsToReproduce: [
        "1. Trigger a password-reset email for a test mailbox.",
        "2. Observe that the message sometimes never arrives.",
        "3. Check notification delivery logs for the attempt.",
        "4. Retry; delivery may succeed on a later attempt.",
        "5. Controlled comparison across mailbox providers is incomplete.",
      ].join("\n"),
      expectedBehaviour:
        "Password-reset and security alert emails should deliver consistently to valid recipient addresses.",
      actualBehaviour:
        "Password-reset emails intermittently fail to deliver despite successful send attempts in the product UI.",
      troubleshootingPerformed: [
        "Confirmed the product records a send attempt.",
        "Collected partial SMTP deferral notes from delivery logs.",
        "Asked whether recipient domains share SPF/DKIM alignment issues.",
        "Requested full ESP bounce payloads for failing messages.",
        "Troubleshooting is incomplete; provider reputation is not ruled out.",
      ].join("\n"),
      logsErrors: [
        "SMTP status: 451",
        "Error: temporary local problem - please try later",
        "Message ID: msg-demo-email-9094",
        "Request ID: req-demo-email-9094",
      ].join("\n"),
      requestIds: "req-demo-email-9094",
      incidentTimestamp: "2026-08-06T11:12:08.000Z",
      issueFirstObserved: "Late July 2026 for a subset of domains",
      affectedCustomerCount: 1,
    },
    analysisPayload: {
      assessedSeverity: "high",
      issueCategory: "unknown",
      reproducibility: "intermittent",
      suspectedProductDefect: false,
      reasoning:
        "High-severity intermittent email delivery failures with partial SMTP evidence. ESP/reputation factors are not ruled out, so continued investigation is appropriate.",
      evidenceIdentified: [
        {
          description: "SMTP 451 deferral",
          sourceField: "logsErrors",
          quotedExcerpt: "SMTP status: 451",
        },
        {
          description: "Temporary local problem",
          sourceField: "logsErrors",
          quotedExcerpt: "temporary local problem",
        },
        {
          description: "Email request ID",
          sourceField: "requestIds",
          quotedExcerpt: "req-demo-email-9094",
        },
        {
          description: "Intermittent non-delivery",
          sourceField: "actualBehaviour",
          quotedExcerpt: "intermittently fail to deliver",
        },
        {
          description: "Incomplete troubleshooting",
          sourceField: "troubleshootingPerformed",
          quotedExcerpt: "Troubleshooting is incomplete",
        },
      ],
      missingEvidence: [
        "Full ESP bounce / deferral payloads",
        "SPF/DKIM/DMARC alignment check for affected domains",
        "Controlled reproduction across multiple mailbox providers",
      ],
      recommendedNextSteps: [
        "Collect complete ESP bounce payloads for failing messages.",
        "Verify SPF/DKIM/DMARC alignment for affected recipient domains.",
        "Reproduce delivery to isolated test mailboxes.",
      ],
      suspectedRootCause: null,
      aiEscalationAssessment: "likely_continue",
    },
  },
  {
    key: "http_504_latency",
    label: "HTTP 504 latency",
    expectedRecommendation: "escalate",
    // Align with hosted Vertex: historically approved with prepared handoff.
    // Orchid (saml_subset_users) remains the ordinary pending escalate review.
    expectedStatus: "escalated",
    reportedAt: "2026-11-05T09:35:00.000Z",
    seedDecision: {
      decision: "approved",
      // Plain-language reason grounded in recorded Vertex evidence only.
      rationale:
        "HTTP 504 Gateway Timeout errors were reproduced in prod. Request IDs and logs were captured, and multiple customer accounts are affected. Engineering investigation is required.",
      decidedAt: "2026-11-05T14:20:00.000Z",
    },
    createInput: {
      customer: `${DEMO} Vertex Media`,
      product: "API Gateway",
      severity: "high",
      issueTitle: `${DEMO} Intermittent HTTP 504 Gateway Timeout Errors`,
      issueDescription:
        "API requests intermittently return HTTP 504 errors in prod.",
      environment: "production",
      stepsToReproduce: [
        "1. Authenticate with a valid API credential.",
        "2. Issue repeated GET requests.",
        "3. Observe intermittent HTTP 504 responses.",
        "4. Capture latency timings for failed versus successful requests.",
        "5. Confirm the pattern reproduces across multiple endpoints.",
      ].join("\n"),
      expectedBehaviour:
        "Authenticated API requests should complete within SLA and return HTTP 200 rather than intermittent 504 timeouts.",
      actualBehaviour:
        "Requests intermittently return HTTP 504 Gateway Timeout in production.",
      troubleshootingPerformed: [
        "Reproduced the issue in production.",
        "Collected gateway timeout logs with request IDs.",
        "Compared p95 latency for successful and failing requests.",
        "Verified client timeouts exceed the gateway timeout threshold.",
        "Ruled out a single client SDK version as the sole cause.",
      ].join("\n"),
      logsErrors: [
        "HTTP status: 504",
        "Error: Gateway Timeout",
        "Request ID: req-demo-504-6618",
        "Timestamp: 2026-11-05T07:22:51Z",
        "upstream_duration_ms: 30112",
      ].join("\n"),
      requestIds: "req-demo-504-6618",
      incidentTimestamp: "2026-11-05T07:22:51.000Z",
      issueFirstObserved: "Week of 27 Oct 2026",
      affectedCustomerCount: 5,
    },
    analysisPayload: {
      assessedSeverity: "high",
      issueCategory: "bug",
      reproducibility: "confirmed",
      suspectedProductDefect: true,
      reasoning:
        "High-severity production gateway timeouts with validated request IDs and latency evidence. Support reproduced intermittent 504s. Human approval still required.",
      evidenceIdentified: [
        {
          description: "HTTP 504 in logs",
          sourceField: "logsErrors",
          quotedExcerpt: "HTTP status: 504",
        },
        {
          description: "Gateway Timeout",
          sourceField: "logsErrors",
          quotedExcerpt: "Error: Gateway Timeout",
        },
        {
          description: "504 request ID",
          sourceField: "requestIds",
          quotedExcerpt: "req-demo-504-6618",
        },
        {
          description: "Intermittent 504 behaviour",
          sourceField: "actualBehaviour",
          quotedExcerpt: "intermittently return HTTP 504",
        },
        {
          description: "Production reproduction",
          sourceField: "troubleshootingPerformed",
          quotedExcerpt: "Reproduced the issue in production",
        },
        {
          description: "Expected SLA completion",
          sourceField: "expectedBehaviour",
          quotedExcerpt: "complete within SLA",
        },
        {
          description: "Reproduction observes 504",
          sourceField: "stepsToReproduce",
          quotedExcerpt: "intermittent HTTP 504 responses",
        },
        {
          description: "Production 504 Gateway Timeout",
          sourceField: "actualBehaviour",
          quotedExcerpt: "HTTP 504 Gateway Timeout in production",
        },
        {
          description: "Prod 504 symptoms in description",
          sourceField: "issueDescription",
          quotedExcerpt: "HTTP 504 errors in prod",
        },
      ],
      missingEvidence: [],
      recommendedNextSteps: [
        "Have a human reviewer approve or reject escalation based on the engine score.",
      ],
      suspectedRootCause:
        "Upstream latency exceeding gateway timeout (inference; not proven).",
      aiEscalationAssessment: "likely_escalate",
    },
  },
] as const;

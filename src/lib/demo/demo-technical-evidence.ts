import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DemoCaseKey } from "@/lib/demo/demo-cases";
import type { CreateTechnicalEvidenceInput } from "@/lib/evidence/evidence-types";
import { TechnicalEvidenceService } from "@/lib/evidence/evidence-service";
import type { CaseRepository } from "@/lib/repositories/case-repository";
import type { TechnicalEvidenceRepository } from "@/lib/repositories/technical-evidence-repository";

const DEMO_ASSET_DIR = join(process.cwd(), "src/lib/demo");

const FALLBACK_PNG_BYTES = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

function loadDemoImage(fileName: string): Uint8Array {
  try {
    return new Uint8Array(readFileSync(join(DEMO_ASSET_DIR, fileName)));
  } catch {
    return FALLBACK_PNG_BYTES;
  }
}

/** @deprecated Prefer loadDemoImage — kept for tests that import PNG bytes. */
function loadDemoPng(fileName: string): Uint8Array {
  return loadDemoImage(fileName);
}

/** Default / generic fictional screenshot (not a customer image). */
export const FICTIONAL_DEMO_PNG_BYTES: Uint8Array = loadDemoPng(
  "fictional-demo-error-screenshot.png",
);

type DemoScreenshotAsset = {
  fileName: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  bytes: Uint8Array;
};

/**
 * Curated fictional screenshot assets that match stored demo case evidence.
 */
export const APPROVED_DEMO_SCREENSHOTS = {
  clear_escalation: {
    fileName: "fictional-demo-northstar-api-500.jpg",
    mustMatch: ["HTTP 500", "req-demo-48291", "2026-09-08T09:14:32"],
  },
  saml_subset_users: {
    fileName: "fictional-demo-orchid-saml.jpg",
    mustMatch: [
      "HTTP 401",
      "Signature validation failed",
      "req-demo-saml-5520",
      "2026-06-25",
      "subset of users",
    ],
  },
  slack_notifications: {
    fileName: "fictional-demo-cascade-slack.jpg",
    mustMatch: [
      "HTTP 500",
      "slack_delivery_failed",
      "req-demo-slack-7741",
      "2026-03-18T08:42:11",
    ],
  },
} as const;

/**
 * Per-case fictional screenshot bytes for Phase B attachments.
 * Northstar / Orchid / Cascade use approved curated JPGs that agree with
 * case diagnostic records. Other cases keep generic PNG placeholders.
 */
function screenshotAssetForCase(key: DemoCaseKey): DemoScreenshotAsset {
  switch (key) {
    case "clear_escalation":
      return {
        fileName: APPROVED_DEMO_SCREENSHOTS.clear_escalation.fileName,
        contentType: "image/jpeg",
        bytes: loadDemoImage(
          APPROVED_DEMO_SCREENSHOTS.clear_escalation.fileName,
        ),
      };
    case "saml_subset_users":
      return {
        fileName: APPROVED_DEMO_SCREENSHOTS.saml_subset_users.fileName,
        contentType: "image/jpeg",
        bytes: loadDemoImage(
          APPROVED_DEMO_SCREENSHOTS.saml_subset_users.fileName,
        ),
      };
    case "slack_notifications":
      return {
        fileName: APPROVED_DEMO_SCREENSHOTS.slack_notifications.fileName,
        contentType: "image/jpeg",
        bytes: loadDemoImage(
          APPROVED_DEMO_SCREENSHOTS.slack_notifications.fileName,
        ),
      };
    case "http_504_latency":
    case "api_rate_limit":
      return {
        fileName: `fictional-demo-${key}-screenshot.png`,
        contentType: "image/png",
        bytes: loadDemoPng("fictional-demo-api-500-screenshot.png"),
      };
    default:
      return {
        fileName: `fictional-demo-${key}-screenshot.png`,
        contentType: "image/png",
        bytes: FICTIONAL_DEMO_PNG_BYTES,
      };
  }
}

function fictional(
  partial: Omit<
    CreateTechnicalEvidenceInput,
    "source" | "verificationStatus"
  >,
): CreateTechnicalEvidenceInput {
  return {
    ...partial,
    source: "demo_fictional",
    verificationStatus: "demo_fictional",
  };
}

/**
 * Fictional diagnostic artefacts for demo cases.
 * Explicitly labelled — no live Datadog or Postman connectivity.
 *
 * Variation is intentional:
 * - Rich packages showcase Phase B management UI.
 * - Sparse packages demonstrate incomplete investigations.
 */
export function buildDemoEvidenceInputs(
  caseId: string,
  key: DemoCaseKey,
): CreateTechnicalEvidenceInput[] {
  switch (key) {
    case "clear_escalation":
      // Existing showcase case — already rich; unchanged titles/bodies.
      return [
        fictional({
          caseId,
          evidenceType: "api_response",
          title: "[FICTIONAL DEMO] API response — article GET 500",
          service: "API v3 /articles/{id}",
          body: [
            "HTTP/1.1 500 Internal Server Error",
            "x-request-id: req-demo-48291",
            "content-type: application/json",
            "",
            "{",
            '  "error": "Internal Server Error",',
            '  "message": "FICTIONAL DEMO artefact — not a live API capture"',
            "}",
          ].join("\n"),
          capturedAt: "2026-09-08T09:14:32.000Z",
          requestId: "req-demo-48291",
          sortOrder: 0,
        }),
        fictional({
          caseId,
          evidenceType: "datadog_log",
          title: "[FICTIONAL DEMO] Datadog log excerpt — article service",
          service: "article-service (demo)",
          body: [
            "FICTIONAL DEMO — not connected to Datadog.",
            "2026-09-08T09:14:32.120Z ERROR article-service",
            "request_id=req-demo-48291 status=500",
            'msg="Unhandled exception while loading article payload"',
          ].join("\n"),
          capturedAt: "2026-09-08T09:14:32.120Z",
          requestId: "req-demo-48291",
          traceId: "demo-trace-00abcdef",
          sortOrder: 1,
        }),
        fictional({
          caseId,
          evidenceType: "postman_result",
          title: "[FICTIONAL DEMO] Postman collection run — article GET",
          service: "Postman (offline export)",
          body: [
            "FICTIONAL DEMO — offline Postman export, not live.",
            "GET {{baseUrl}}/v3/articles/10042",
            "Status: 500",
            "Time: 412 ms",
            "x-request-id: req-demo-48291",
          ].join("\n"),
          capturedAt: "2026-09-08T10:02:00.000Z",
          requestId: "req-demo-48291",
          sortOrder: 2,
        }),
        fictional({
          caseId,
          evidenceType: "screenshot",
          title:
            "[FICTIONAL DEMO] Screenshot — API Testing Studio (HTTP 500)",
          caption:
            "FICTIONAL DEMO — synthetic API Testing Studio capture for Northstar Financial / API v3. Matches case request ID req-demo-48291, HTTP 500, and 2026-09-08T09:14:32Z. Not a live customer capture.",
          capturedAt: "2026-09-08T10:05:00.000Z",
          sortOrder: 3,
        }),
      ];
    case "insufficient_evidence":
      // Deliberately sparse — incomplete SAML package.
      return [
        fictional({
          caseId,
          evidenceType: "auth_error",
          title: "[FICTIONAL DEMO] Partial SSO failure note",
          service: "SSO / SAML",
          body: [
            "FICTIONAL DEMO — incomplete SAML package.",
            "Customer note: authentication failed after IdP certificate rotation.",
            "No assertion XML or correlation ID captured yet.",
          ].join("\n"),
          sortOrder: 0,
        }),
      ];
    case "continue_investigation":
      // Deliberately sparse — observational note only.
      return [
        fictional({
          caseId,
          evidenceType: "other",
          title: "[FICTIONAL DEMO] Customer note — Auto-Answer timeout",
          service: "MS Teams Integration",
          body: [
            "FICTIONAL DEMO — observational note only.",
            "Customer-provided note: Auto-Answer timeout in public channel.",
            "No complete webhook or bot-permission log package yet.",
          ].join("\n"),
          requestId: "teams-public-ch-pending",
          sortOrder: 0,
        }),
      ];
    case "search_indexing":
      return [
        fictional({
          caseId,
          evidenceType: "datadog_log",
          title: "[FICTIONAL DEMO] Datadog log — indexer worker",
          service: "search-indexer (demo)",
          body: [
            "FICTIONAL DEMO — not connected to Datadog.",
            "2026-01-22T09:18:44.200Z ERROR search-indexer",
            "request_id=req-demo-search-1182",
            'msg="IndexerWorkerException: failed to upsert document"',
          ].join("\n"),
          capturedAt: "2026-01-22T09:18:44.200Z",
          requestId: "req-demo-search-1182",
          traceId: "demo-trace-search-1182",
          sortOrder: 0,
        }),
        fictional({
          caseId,
          evidenceType: "application_log",
          title: "[FICTIONAL DEMO] Application log — publish acknowledged",
          service: "knowledge-publish",
          body: [
            "FICTIONAL DEMO artefact.",
            "2026-01-22T09:17:58Z INFO publish ok article_id=kb-44021",
            "2026-01-22T09:18:44Z ERROR index upsert failed article_id=kb-44021",
          ].join("\n"),
          capturedAt: "2026-01-22T09:18:44.000Z",
          requestId: "req-demo-search-1182",
          sortOrder: 1,
        }),
        fictional({
          caseId,
          evidenceType: "postman_result",
          title: "[FICTIONAL DEMO] Postman — search query after publish",
          service: "Postman (offline export)",
          body: [
            "FICTIONAL DEMO — offline Postman export, not live.",
            "GET {{baseUrl}}/search?q=kb-44021",
            "Status: 200",
            "hits: 0",
            "x-request-id: req-demo-search-query-1182",
          ].join("\n"),
          capturedAt: "2026-01-22T10:02:00.000Z",
          requestId: "req-demo-search-query-1182",
          sortOrder: 2,
        }),
        fictional({
          caseId,
          evidenceType: "screenshot",
          title: "[FICTIONAL DEMO] Screenshot — missing search hit",
          caption:
            "FICTIONAL DEMO placeholder — empty search results for a published article.",
          capturedAt: "2026-01-22T14:10:00.000Z",
          sortOrder: 3,
        }),
      ];
    case "slack_notifications":
      return [
        fictional({
          caseId,
          evidenceType: "api_response",
          title: "[FICTIONAL DEMO] Slack webhook delivery 500",
          service: "slack-notifier /hooks",
          body: [
            "HTTP/1.1 500 Internal Server Error",
            "x-request-id: req-demo-slack-7741",
            "",
            '{ "error": "slack_delivery_failed", "note": "FICTIONAL DEMO" }',
          ].join("\n"),
          capturedAt: "2026-03-18T08:42:11.000Z",
          requestId: "req-demo-slack-7741",
          sortOrder: 0,
        }),
        fictional({
          caseId,
          evidenceType: "datadog_log",
          title: "[FICTIONAL DEMO] Datadog log — slack delivery",
          service: "slack-notifier (demo)",
          body: [
            "FICTIONAL DEMO — not connected to Datadog.",
            "2026-03-18T08:42:11.080Z ERROR slack-notifier",
            "request_id=req-demo-slack-7741 status=500",
            'msg="outbound webhook delivery failed"',
          ].join("\n"),
          capturedAt: "2026-03-18T08:42:11.080Z",
          requestId: "req-demo-slack-7741",
          traceId: "demo-trace-slack-7741",
          sortOrder: 1,
        }),
        fictional({
          caseId,
          evidenceType: "postman_result",
          title: "[FICTIONAL DEMO] Postman — Slack webhook POST",
          service: "Postman (offline export)",
          body: [
            "FICTIONAL DEMO — offline Postman export, not live.",
            "POST {{slackWebhookUrl}}",
            "Status: 500",
            "Time: 288 ms",
            "x-request-id: req-demo-slack-7741",
          ].join("\n"),
          capturedAt: "2026-03-18T09:15:00.000Z",
          requestId: "req-demo-slack-7741",
          sortOrder: 2,
        }),
        fictional({
          caseId,
          evidenceType: "screenshot",
          title:
            "[FICTIONAL DEMO] Screenshot — Slack webhook delivery failure",
          caption:
            "FICTIONAL DEMO — Integration Monitor synthetic capture for Cascade Retail. Matches HTTP 500 / slack_delivery_failed / req-demo-slack-7741 at 2026-03-18T08:42:11Z. Not a live Slack capture.",
          capturedAt: "2026-03-18T11:40:00.000Z",
          sortOrder: 3,
        }),
      ];
    case "scim_provisioning":
      // Deliberately sparse — incomplete SCIM package.
      return [
        fictional({
          caseId,
          evidenceType: "other",
          title: "[FICTIONAL DEMO] Partial SCIM provisioning note",
          service: "SCIM Directory Sync",
          body: [
            "FICTIONAL DEMO — incomplete SCIM package.",
            "Customer note: SCIM provisioning skipped for some users.",
            "No complete SCIM request/response captured yet.",
          ].join("\n"),
          sortOrder: 0,
        }),
      ];
    case "api_rate_limit":
      return [
        fictional({
          caseId,
          evidenceType: "api_response",
          title: "[FICTIONAL DEMO] API response — HTTP 429",
          service: "API v3 /articles",
          body: [
            "HTTP/1.1 429 Too Many Requests",
            "x-request-id: req-demo-429-3301",
            "x-ratelimit-remaining: 0",
            "retry-after: 12",
            "",
            '{ "error": "rate_limit_exceeded", "note": "FICTIONAL DEMO" }',
          ].join("\n"),
          capturedAt: "2026-05-14T07:55:02.000Z",
          requestId: "req-demo-429-3301",
          sortOrder: 0,
        }),
        fictional({
          caseId,
          evidenceType: "postman_result",
          title: "[FICTIONAL DEMO] Postman burst — rate limit",
          service: "Postman (offline export)",
          body: [
            "FICTIONAL DEMO — offline Postman export, not live.",
            "GET {{baseUrl}}/v3/articles?limit=50 (burst x40)",
            "Status: 429",
            "x-request-id: req-demo-429-3301",
          ].join("\n"),
          capturedAt: "2026-05-14T09:40:00.000Z",
          requestId: "req-demo-429-3301",
          sortOrder: 1,
        }),
        fictional({
          caseId,
          evidenceType: "datadog_log",
          title: "[FICTIONAL DEMO] Datadog log — rate limiter",
          service: "api-gateway (demo)",
          body: [
            "FICTIONAL DEMO — not connected to Datadog.",
            "2026-05-14T07:55:02.040Z WARN api-gateway",
            "request_id=req-demo-429-3301 status=429",
            'msg="tenant quota exhausted for key prefix demo-key"',
          ].join("\n"),
          capturedAt: "2026-05-14T07:55:02.040Z",
          requestId: "req-demo-429-3301",
          traceId: "demo-trace-429-3301",
          sortOrder: 2,
        }),
      ];
    case "saml_subset_users":
      return [
        fictional({
          caseId,
          evidenceType: "auth_error",
          title: "[FICTIONAL DEMO] SAML signature validation failure",
          service: "SSO / SAML",
          body: [
            "FICTIONAL DEMO — synthetic SAML diagnostic excerpt.",
            "HTTP status: 401",
            "Error: Signature validation failed",
            "Request ID: req-demo-saml-5520",
            "Timestamp: 2026-06-25T09:05:33Z",
            "Note: assertion XML redacted; not a live IdP capture.",
          ].join("\n"),
          capturedAt: "2026-06-25T09:05:33.000Z",
          requestId: "req-demo-saml-5520",
          sortOrder: 0,
        }),
        fictional({
          caseId,
          evidenceType: "application_log",
          title: "[FICTIONAL DEMO] Application log — SSO ACS",
          service: "sso-acs (demo)",
          body: [
            "FICTIONAL DEMO artefact.",
            "2026-06-25T09:05:33.040Z WARN sso-acs",
            "request_id=req-demo-saml-5520",
            'msg="rejecting assertion: Signature validation failed"',
          ].join("\n"),
          capturedAt: "2026-06-25T09:05:33.040Z",
          requestId: "req-demo-saml-5520",
          sortOrder: 1,
        }),
        fictional({
          caseId,
          evidenceType: "datadog_log",
          title: "[FICTIONAL DEMO] Datadog log — SSO ACS failures",
          service: "sso-acs (demo)",
          body: [
            "FICTIONAL DEMO — not connected to Datadog.",
            "2026-06-25T09:05:33.055Z ERROR sso-acs",
            "request_id=req-demo-saml-5520",
            'msg="signature validation failed for assertion"',
          ].join("\n"),
          capturedAt: "2026-06-25T09:05:33.055Z",
          requestId: "req-demo-saml-5520",
          traceId: "demo-trace-saml-5520",
          sortOrder: 2,
        }),
        fictional({
          caseId,
          evidenceType: "screenshot",
          title:
            "[FICTIONAL DEMO] Screenshot — Platform Diagnostics (SAML 401)",
          caption:
            "FICTIONAL DEMO — Platform Diagnostics synthetic capture for Orchid Health. Matches HTTP 401 / Signature validation failed / req-demo-saml-5520 at 2026-06-25T09:05:33Z. Does not assert a confirmed certificate-rotation root cause. Not a live IdP capture.",
          capturedAt: "2026-06-25T11:20:00.000Z",
          sortOrder: 3,
        }),
      ];
    case "email_delivery":
      return [
        fictional({
          caseId,
          evidenceType: "application_log",
          title: "[FICTIONAL DEMO] Email delivery deferral log",
          service: "email-notifications (demo)",
          body: [
            "FICTIONAL DEMO — synthetic ESP/SMTP excerpt.",
            "SMTP status: 451",
            "Error: temporary local problem - please try later",
            "Message ID: msg-demo-email-9094",
            "Request ID: req-demo-email-9094",
          ].join("\n"),
          capturedAt: "2026-08-06T11:12:08.000Z",
          requestId: "req-demo-email-9094",
          sortOrder: 0,
        }),
        fictional({
          caseId,
          evidenceType: "datadog_log",
          title: "[FICTIONAL DEMO] Datadog log — mail deferrals",
          service: "email-notifications (demo)",
          body: [
            "FICTIONAL DEMO — not connected to Datadog.",
            "2026-08-06T11:12:08.090Z WARN email-notifications",
            "request_id=req-demo-email-9094 smtp=451",
            'msg="deferred password-reset delivery"',
          ].join("\n"),
          capturedAt: "2026-08-06T11:12:08.090Z",
          requestId: "req-demo-email-9094",
          traceId: "demo-trace-email-9094",
          sortOrder: 1,
        }),
        fictional({
          caseId,
          evidenceType: "other",
          title: "[FICTIONAL DEMO] Partial bounce note",
          service: "Email Notifications",
          body: [
            "FICTIONAL DEMO — incomplete bounce package.",
            "Customer note: password-reset mail intermittently deferred.",
            "Full ESP bounce payload not yet collected.",
          ].join("\n"),
          requestId: "req-demo-email-9094",
          sortOrder: 2,
        }),
        fictional({
          caseId,
          evidenceType: "screenshot",
          title: "[FICTIONAL DEMO] Screenshot — delivery status UI",
          caption:
            "FICTIONAL DEMO placeholder — synthetic deferred delivery status.",
          capturedAt: "2026-08-06T15:05:00.000Z",
          sortOrder: 3,
        }),
      ];
    case "http_504_latency":
      return [
        fictional({
          caseId,
          evidenceType: "api_response",
          title: "[FICTIONAL DEMO] API Gateway 504 response",
          service: "API Gateway",
          body: [
            "HTTP/1.1 504 Gateway Timeout",
            "x-request-id: req-demo-504-6618",
            "",
            '{ "error": "Gateway Timeout", "note": "FICTIONAL DEMO" }',
          ].join("\n"),
          capturedAt: "2026-11-05T07:22:51.000Z",
          requestId: "req-demo-504-6618",
          sortOrder: 0,
        }),
        fictional({
          caseId,
          evidenceType: "datadog_trace",
          title: "[FICTIONAL DEMO] Datadog trace — upstream latency",
          service: "api-gateway (demo)",
          body: [
            "FICTIONAL DEMO — not connected to Datadog.",
            "trace_id=demo-trace-504-6618 span=gateway.proxy",
            "request_id=req-demo-504-6618",
            "upstream_duration_ms=30112 status=504",
          ].join("\n"),
          capturedAt: "2026-11-05T07:22:51.200Z",
          requestId: "req-demo-504-6618",
          traceId: "demo-trace-504-6618",
          sortOrder: 1,
        }),
        fictional({
          caseId,
          evidenceType: "postman_result",
          title: "[FICTIONAL DEMO] Postman peak-load sample",
          service: "Postman (offline export)",
          body: [
            "FICTIONAL DEMO — offline Postman export, not live.",
            "GET {{baseUrl}}/gateway/v1/resources/42",
            "Status: 504",
            "Time: 30140 ms",
            "x-request-id: req-demo-504-6618",
          ].join("\n"),
          capturedAt: "2026-11-05T08:05:00.000Z",
          requestId: "req-demo-504-6618",
          sortOrder: 2,
        }),
        fictional({
          caseId,
          evidenceType: "screenshot",
          title: "[FICTIONAL DEMO] Screenshot — gateway timeout client",
          caption:
            "FICTIONAL DEMO placeholder — synthetic client timeout error.",
          capturedAt: "2026-11-05T09:10:00.000Z",
          sortOrder: 3,
        }),
      ];
    default:
      return [];
  }
}

/**
 * Seeds structured evidence for a demo case.
 * Idempotent for non-demo evidence. Replaces outdated demo_fictional packages
 * when the canonical fixture set has changed (so reseeds pick up richer demos).
 */
export async function seedDemoTechnicalEvidenceForCase(options: {
  caseId: string;
  key: DemoCaseKey;
  cases: CaseRepository;
  evidence: TechnicalEvidenceRepository;
}): Promise<{ created: number; skipped: boolean; refreshed: boolean }> {
  const service = new TechnicalEvidenceService(options.cases, options.evidence);
  const existing = await service.listForCase(options.caseId);
  const expected = buildDemoEvidenceInputs(options.caseId, options.key);
  const expectedTitles = new Set(expected.map((item) => item.title));
  const existingTitles = new Set(existing.map((item) => item.title));
  const allDemo =
    existing.length > 0 &&
    existing.every((item) => item.source === "demo_fictional");
  const outdated =
    allDemo &&
    (existing.length !== expected.length ||
      [...expectedTitles].some((title) => !existingTitles.has(title)));

  if (existing.length > 0 && !outdated) {
    return { created: 0, skipped: true, refreshed: false };
  }

  if (outdated) {
    for (const item of existing) {
      await service.delete(options.caseId, item.id);
    }
  }

  let created = 0;
  for (const input of expected) {
    const record = await service.create(input);
    created += 1;
    if (input.evidenceType === "screenshot") {
      const asset = screenshotAssetForCase(options.key);
      await service.addScreenshot({
        caseId: options.caseId,
        evidenceId: record.id,
        fileName: asset.fileName,
        contentType: asset.contentType,
        bytes: asset.bytes,
      });
    }
  }
  return { created, skipped: false, refreshed: outdated };
}

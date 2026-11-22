/**
 * Narrow hosted fictional demo wording updates (explicitly approved).
 * Updates support_cases titles/descriptions (+ related narrative fields) and
 * escalated engineering_handoffs snapshots. Does not touch decisions, scores,
 * severity, status, or technical evidence artefacts.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const DEMO = "[DEMO]";

const CASES = [
  {
    key: "clear_escalation",
    id: "52144e0c-9797-4e5d-8097-551fc644dd63",
    customer: "Northstar Financial",
    updateHandoff: true,
    support: {
      issue_title: `${DEMO} HTTP 500 errors when retrieving articles via API v3`,
      issue_description:
        "Customers intermittently get HTTP 500 when retrieving articles via API v3 in prod. Request ID: req-demo-48291.",
    },
  },
  {
    key: "insufficient_evidence",
    id: "997f45ad-f686-4724-a3c1-094d659a3741",
    customer: "Meridian Systems",
    updateHandoff: false,
    support: {
      issue_title: `${DEMO} SSO login fails for some users after IdP certificate rotation`,
      issue_description:
        "Some users cannot log in via SSO after an IdP certificate rotation. Still waiting for complete SAML error details.",
      actual_behaviour:
        "SSO login fails for some users after the identity provider certificate rotation.",
      troubleshooting_performed: [
        "Confirmed the customer recently rotated the IdP signing certificate.",
        "Asked for the rotation window and affected user samples.",
        "Requested SAML response / assertion for a failing login.",
        "Still waiting for complete SAML error details.",
      ].join("\n"),
    },
  },
  {
    key: "continue_investigation",
    id: "7f613c76-952c-48bb-af67-20ff9de73163",
    customer: "Apex Digital",
    updateHandoff: false,
    support: {
      issue_title: `${DEMO} MS Teams Auto-Answer not responding in public channels`,
      issue_description:
        "Auto-Answer works in some private channels but does not respond in public channels. Still checking channel permissions / bot membership.",
      troubleshooting_performed: [
        "Confirmed the issue is reported in public channels.",
        "Compared behaviour with a private channel that still responds.",
        "Asked whether bot permissions differ by channel type.",
        "Requested Teams activity / webhook samples for a failing public-channel attempt.",
        "Troubleshooting is incomplete; still checking channel permissions / bot membership.",
      ].join("\n"),
    },
  },
  {
    key: "search_indexing",
    id: "dc10c410-3a18-41b1-8f7c-07cd292e11a5",
    customer: "Helix Analytics",
    updateHandoff: true,
    support: {
      issue_title: `${DEMO} New articles not appearing in Enterprise Search`,
      issue_description:
        "New articles stay missing from Enterprise Search for hours after publish. Indexer logs show failures (req-demo-search-1182).",
    },
  },
  {
    key: "slack_notifications",
    id: "0138f515-69b6-4651-8ae2-60ff18188095",
    customer: "Cascade Retail",
    updateHandoff: true,
    support: {
      issue_title: `${DEMO} Slack channel notifications not delivering`,
      issue_description:
        "Slack notifications are not reaching configured channels. Delivery logs show HTTP 500 slack_delivery_failed (req-demo-slack-7741).",
    },
  },
  {
    key: "scim_provisioning",
    id: "4218ff91-8030-4b69-b7fa-aaa95de3f242",
    customer: "Summit Workforce",
    updateHandoff: false,
    support: {
      issue_title: `${DEMO} SCIM not provisioning some new users`,
      issue_description:
        "Some new IdP users never appear in the product directory after SCIM sync. Complete SCIM request/response pairs not yet available.",
    },
  },
  {
    key: "api_rate_limit",
    id: "caec85c1-b53a-4a64-aa80-a5fdcca7e4b8",
    customer: "Blue Harbor Logistics",
    updateHandoff: false,
    support: {
      issue_title: `${DEMO} Intermittent HTTP 429 errors from API v3`,
      issue_description:
        "API clients intermittently receive HTTP 429 in prod. Need to confirm quota headers and client retry/backoff before escalating.",
      actual_behaviour:
        "Clients intermittently receive HTTP 429 rate-limit responses in prod.",
      issue_first_observed: "First noticed on 12 May 2026",
    },
  },
  {
    key: "saml_subset_users",
    id: "ea1437f9-588f-418b-8222-c11079d246c2",
    customer: "Orchid Health",
    updateHandoff: false,
    support: {
      issue_title: `${DEMO} SAML SSO failing for some users`,
      issue_description:
        "Some users fail SAML SSO while peers on the same IdP succeed. Captured error: Signature validation failed (req-demo-saml-5520).",
    },
  },
  {
    key: "email_delivery",
    id: "cba189e2-a487-46d1-97db-0f5e21d7b2a1",
    customer: "Brightline Insurance",
    updateHandoff: false,
    support: {
      issue_title: `${DEMO} Password-reset emails intermittently not delivering`,
      issue_description:
        "Password-reset and security emails are intermittently not being delivered. Some SMTP deferrals have been identified, but we're still waiting for complete bounce logs.",
    },
  },
  {
    key: "http_504_latency",
    id: "b04a05d3-9bbb-45c2-8abc-43b2f70bcd15",
    customer: "Vertex Media",
    updateHandoff: true,
    support: {
      issue_title: `${DEMO} Intermittent HTTP 504 Gateway Timeout Errors`,
      issue_description:
        "API requests intermittently return HTTP 504 errors in prod.",
      actual_behaviour:
        "Requests intermittently return HTTP 504 with elevated upstream latency.",
      troubleshooting_performed: [
        "Reproduced the issue in production.",
        "Collected gateway timeout logs with request IDs.",
        "Compared p95 latency for successful and failing requests.",
        "Verified client timeouts exceed the gateway timeout threshold.",
        "Ruled out a single client SDK version as the sole cause.",
      ].join("\n"),
      steps_to_reproduce: [
        "1. Authenticate with a valid API credential.",
        "2. Issue repeated GET requests.",
        "3. Observe intermittent HTTP 504 responses.",
        "4. Capture latency timings for failed versus successful requests.",
        "5. Confirm the pattern reproduces across multiple endpoints.",
      ].join("\n"),
      issue_first_observed: "Week of 27 Oct 2026",
    },
    preserveDecisionRationale:
      "HTTP 504 gateway timeouts were reproduced in production, affecting multiple customer accounts. Request IDs and gateway logs were captured during troubleshooting. Engineering investigation is required to determine the underlying cause.",
  },
];

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const results = [];

for (const entry of CASES) {
  const { data: row, error } = await client
    .from("support_cases")
    .select(
      "id, customer, status, issue_title, issue_description, actual_behaviour, troubleshooting_performed, steps_to_reproduce, issue_first_observed, severity, environment",
    )
    .eq("id", entry.id)
    .maybeSingle();
  if (error) throw error;
  assert(row, `Missing case ${entry.id}`);
  assert(
    row.customer.includes(entry.customer),
    `Customer mismatch for ${entry.key}: ${row.customer}`,
  );

  const before = {
    issue_title: row.issue_title,
    issue_description: row.issue_description,
    actual_behaviour: row.actual_behaviour,
    troubleshooting_performed: row.troubleshooting_performed,
    steps_to_reproduce: row.steps_to_reproduce,
    issue_first_observed: row.issue_first_observed,
    status: row.status,
    severity: row.severity,
  };

  const { error: updErr } = await client
    .from("support_cases")
    .update(entry.support)
    .eq("id", entry.id);
  if (updErr) throw updErr;

  let handoffAfter = null;
  if (entry.updateHandoff) {
    const { data: handoff, error: hErr } = await client
      .from("engineering_handoffs")
      .select(
        "id, title, summary, actual_behaviour, troubleshooting_performed, decision_rationale, created_at",
      )
      .eq("case_id", entry.id)
      .maybeSingle();
    if (hErr) throw hErr;
    assert(handoff, `Expected handoff for escalated case ${entry.key}`);

    if (entry.preserveDecisionRationale) {
      assert(
        handoff.decision_rationale === entry.preserveDecisionRationale,
        `Vertex decision_rationale unexpectedly changed before wording update`,
      );
    }

    const handoffUpdate = {
      title: entry.support.issue_title,
      summary: entry.support.issue_description,
    };
    if (entry.support.actual_behaviour) {
      handoffUpdate.actual_behaviour = entry.support.actual_behaviour;
    }
    if (entry.support.troubleshooting_performed) {
      handoffUpdate.troubleshooting_performed =
        entry.support.troubleshooting_performed;
    }

    const { error: huErr } = await client
      .from("engineering_handoffs")
      .update(handoffUpdate)
      .eq("id", handoff.id)
      .eq("case_id", entry.id);
    if (huErr) throw huErr;

    const { data: handoff2, error: h2Err } = await client
      .from("engineering_handoffs")
      .select(
        "id, title, summary, actual_behaviour, troubleshooting_performed, decision_rationale, created_at",
      )
      .eq("id", handoff.id)
      .single();
    if (h2Err) throw h2Err;
    handoffAfter = handoff2;
    assert(handoff2.created_at === handoff.created_at, "handoff created_at changed");
    if (entry.preserveDecisionRationale) {
      assert(
        handoff2.decision_rationale === entry.preserveDecisionRationale,
        "Vertex decision_rationale was modified",
      );
    }
  }

  const eventId = randomUUID();
  const { error: evErr } = await client.from("case_events").insert({
    id: eventId,
    case_id: entry.id,
    event_type: "demo_wording_corrected",
    metadata: {
      reason: "Simplified fictional demo Support-ticket wording for portfolio clarity",
      key: entry.key,
      previous: before,
      applied: entry.support,
      handoffUpdated: Boolean(entry.updateHandoff),
      preserved: {
        status: before.status,
        severity: before.severity,
        decisionRationaleUntouched: true,
      },
    },
    created_at: new Date().toISOString(),
  });
  if (evErr) throw evErr;

  const { data: after, error: afterErr } = await client
    .from("support_cases")
    .select("id, issue_title, issue_description, actual_behaviour, status, severity")
    .eq("id", entry.id)
    .single();
  if (afterErr) throw afterErr;
  assert(after.issue_title === entry.support.issue_title, "title not applied");
  assert(
    after.issue_description === entry.support.issue_description,
    "description not applied",
  );
  assert(after.status === before.status, "status changed");
  assert(after.severity === before.severity, "severity changed");

  results.push({
    key: entry.key,
    id: entry.id,
    eventId,
    title: after.issue_title,
    description: after.issue_description,
    handoffId: handoffAfter?.id ?? null,
    peakLoadGone:
      entry.key === "http_504_latency"
        ? !/peak load|peak traffic|peak window/i.test(
            `${after.issue_title}\n${after.issue_description}\n${after.actual_behaviour ?? ""}`,
          )
        : undefined,
  });
  console.log("updated", entry.key);
}

console.log(JSON.stringify({ ok: true, count: results.length, results }, null, 2));

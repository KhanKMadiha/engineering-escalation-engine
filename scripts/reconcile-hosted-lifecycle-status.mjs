/**
 * Narrow hosted correction: Meridian + Summit fictional demo status only.
 * Explicitly approved. Aligns stored status with Phase 1 routing for
 * insufficient_evidence cases that still store awaiting_decision.
 *
 * Usage: node --env-file=.env.local scripts/reconcile-hosted-lifecycle-status.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const TARGETS = [
  {
    key: "meridian",
    id: "997f45ad-f686-4724-a3c1-094d659a3741",
    customer: "Meridian Systems",
  },
  {
    key: "summit",
    id: "4218ff91-8030-4b69-b7fa-aaa95de3f242",
    customer: "Summit Workforce",
  },
];

const FROM = "awaiting_decision";
const TO = "investigation_continues";
const EXPECTED_RECOMMENDATION = "insufficient_evidence";

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const results = [];

for (const target of TARGETS) {
  const { data: row, error: caseErr } = await client
    .from("support_cases")
    .select("id, customer, status, severity")
    .eq("id", target.id)
    .maybeSingle();
  if (caseErr) throw caseErr;
  assert(row, `Case ${target.id} not found`);
  assert(
    row.customer.includes(target.customer),
    `Customer mismatch: ${row.customer}`,
  );
  assert(
    row.status === FROM,
    `${target.key} status is ${row.status}, expected ${FROM}`,
  );

  const { data: esc, error: escErr } = await client
    .from("escalation_results")
    .select("recommendation, escalation_score")
    .eq("case_id", target.id)
    .maybeSingle();
  if (escErr) throw escErr;
  assert(esc, `Missing escalation_results for ${target.key}`);
  assert(
    esc.recommendation === EXPECTED_RECOMMENDATION,
    `${target.key} recommendation is ${esc.recommendation}`,
  );

  const { data: decisions, error: decErr } = await client
    .from("human_decisions")
    .select("id")
    .eq("case_id", target.id);
  if (decErr) throw decErr;
  assert(
    !decisions?.length,
    `${target.key} has unexpected decision(s): ${JSON.stringify(decisions)}`,
  );

  const { data: handoffs, error: handErr } = await client
    .from("engineering_handoffs")
    .select("id")
    .eq("case_id", target.id);
  if (handErr) throw handErr;
  assert(
    !handoffs?.length,
    `${target.key} has unexpected handoff(s): ${JSON.stringify(handoffs)}`,
  );

  const { error: updErr } = await client
    .from("support_cases")
    .update({ status: TO })
    .eq("id", target.id)
    .eq("status", FROM);
  if (updErr) throw updErr;

  const eventId = randomUUID();
  const { error: evErr } = await client.from("case_events").insert({
    id: eventId,
    case_id: target.id,
    event_type: "status_changed",
    metadata: {
      from: FROM,
      to: TO,
      reason: "Phase 1 lifecycle reconciliation for fictional demo",
      key: target.key,
      preserved: {
        recommendation: esc.recommendation,
        escalationScore: esc.escalation_score,
        severity: row.severity,
        decisionsUntouched: true,
        assessmentsUntouched: true,
      },
    },
    created_at: new Date().toISOString(),
  });
  if (evErr) throw evErr;

  const { data: after, error: afterErr } = await client
    .from("support_cases")
    .select("id, status")
    .eq("id", target.id)
    .single();
  if (afterErr) throw afterErr;
  assert(after.status === TO, `${target.key} status not updated`);

  results.push({
    key: target.key,
    id: target.id,
    eventId,
    from: FROM,
    to: after.status,
    recommendation: esc.recommendation,
  });
  console.log("reconciled", target.key, eventId);
}

console.log(JSON.stringify({ ok: true, results }, null, 2));

/**
 * Narrow hosted correction: Vertex Media demo approval rationale only.
 * Explicitly approved for portfolio accuracy. Does not change status,
 * scores, decision outcome, reviewer, decidedAt, or handoff identity.
 *
 * Usage: node --env-file=.env.local scripts/correct-vertex-rationale.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const CASE_ID = "b04a05d3-9bbb-45c2-8abc-43b2f70bcd15";
const DECISION_ID = "8770f9c4-4be1-4e96-8daa-fee2e683321f";
const HANDOFF_ID = "b50feb8b-0e26-493e-a602-f73bb5341aac";
const EXPECTED_OLD = "think its good";
const NEW_RATIONALE =
  "HTTP 504 gateway timeouts were reproduced in production, affecting multiple customer accounts. Request IDs and gateway logs were captured during troubleshooting. Engineering investigation is required to determine the underlying cause.";

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

const { data: supportCase, error: caseErr } = await client
  .from("support_cases")
  .select("id, customer, status, issue_title")
  .eq("id", CASE_ID)
  .maybeSingle();
if (caseErr) throw caseErr;
assert(supportCase, `Case ${CASE_ID} not found`);
assert(
  /Vertex Media/i.test(supportCase.customer),
  `Unexpected customer: ${supportCase.customer}`,
);
assert(
  supportCase.status === "escalated",
  `Unexpected status: ${supportCase.status}`,
);

const { data: decision, error: decErr } = await client
  .from("human_decisions")
  .select("*")
  .eq("id", DECISION_ID)
  .eq("case_id", CASE_ID)
  .maybeSingle();
if (decErr) throw decErr;
assert(decision, `Decision ${DECISION_ID} not found`);
assert(decision.decision === "approved", `Unexpected decision: ${decision.decision}`);
assert(
  decision.rationale === EXPECTED_OLD,
  `Unexpected current rationale: ${JSON.stringify(decision.rationale)}`,
);

const { data: handoff, error: handErr } = await client
  .from("engineering_handoffs")
  .select("*")
  .eq("id", HANDOFF_ID)
  .eq("case_id", CASE_ID)
  .maybeSingle();
if (handErr) throw handErr;
assert(handoff, `Handoff ${HANDOFF_ID} not found`);
assert(
  handoff.decision_rationale === EXPECTED_OLD,
  `Unexpected handoff rationale: ${JSON.stringify(handoff.decision_rationale)}`,
);

const snapshot = {
  decidedAt: decision.decided_at,
  decidedBy: decision.decided_by,
  decision: decision.decision,
  score: decision.escalation_score_at_decision,
  recommendation: decision.recommendation_at_decision,
  handoffId: handoff.id,
  handoffCreatedAt: handoff.created_at,
};

console.log("Verified target records. Snapshot:", snapshot);

const { error: updDecErr } = await client
  .from("human_decisions")
  .update({ rationale: NEW_RATIONALE })
  .eq("id", DECISION_ID)
  .eq("case_id", CASE_ID)
  .eq("rationale", EXPECTED_OLD);
if (updDecErr) throw updDecErr;

const { error: updHandErr } = await client
  .from("engineering_handoffs")
  .update({ decision_rationale: NEW_RATIONALE })
  .eq("id", HANDOFF_ID)
  .eq("case_id", CASE_ID)
  .eq("decision_rationale", EXPECTED_OLD);
if (updHandErr) throw updHandErr;

const eventId = randomUUID();
const { error: eventErr } = await client.from("case_events").insert({
  id: eventId,
  case_id: CASE_ID,
  event_type: "demo_rationale_corrected",
  metadata: {
    reason:
      "Corrected unprofessional fictional test approval rationale for portfolio accuracy",
    previousRationale: EXPECTED_OLD,
    newRationale: NEW_RATIONALE,
    decisionId: DECISION_ID,
    handoffId: HANDOFF_ID,
    preserved: {
      decision: snapshot.decision,
      decidedBy: snapshot.decidedBy,
      decidedAt: snapshot.decidedAt,
      escalationScoreAtDecision: snapshot.score,
      recommendationAtDecision: snapshot.recommendation,
      handoffId: snapshot.handoffId,
      handoffCreatedAt: snapshot.handoffCreatedAt,
    },
  },
  created_at: new Date().toISOString(),
});
if (eventErr) throw eventErr;

const { data: decisionAfter, error: decAfterErr } = await client
  .from("human_decisions")
  .select(
    "id, decision, rationale, decided_at, decided_by, escalation_score_at_decision, recommendation_at_decision",
  )
  .eq("id", DECISION_ID)
  .single();
if (decAfterErr) throw decAfterErr;

const { data: handoffAfter, error: handAfterErr } = await client
  .from("engineering_handoffs")
  .select("id, decision_rationale, created_at")
  .eq("id", HANDOFF_ID)
  .single();
if (handAfterErr) throw handAfterErr;

assert(decisionAfter.rationale === NEW_RATIONALE, "Decision rationale not updated");
assert(
  handoffAfter.decision_rationale === NEW_RATIONALE,
  "Handoff rationale not updated",
);
assert(decisionAfter.decision === "approved", "Decision outcome changed");
assert(decisionAfter.decided_at === snapshot.decidedAt, "decided_at changed");
assert(decisionAfter.decided_by === snapshot.decidedBy, "decided_by changed");
assert(
  decisionAfter.escalation_score_at_decision === snapshot.score,
  "score changed",
);
assert(handoffAfter.id === snapshot.handoffId, "handoff id changed");
assert(
  handoffAfter.created_at === snapshot.handoffCreatedAt,
  "handoff created_at changed",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      caseId: CASE_ID,
      eventId,
      decision: decisionAfter,
      handoff: handoffAfter,
    },
    null,
    2,
  ),
);

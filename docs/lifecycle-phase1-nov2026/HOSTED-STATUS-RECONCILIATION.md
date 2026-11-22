# Hosted status reconciliation

**Applied 2026-11-22** (explicit approval). Meridian + Summit stored status updated to `investigation_continues`. Audit: `status_changed` with reason `Phase 1 lifecycle reconciliation for fictional demo`.

Phase 1 domain routing writes `investigation_continues` for non-escalate recommendations. Two hosted fictional demo rows previously stored the pre–Phase 1 status `awaiting_decision` while their engine recommendation was `insufficient_evidence`.

Presentation/queue/stage safeguards already treated these rows as investigation-continues. This update aligned **stored** status with that lifecycle.

## Affected cases (read from hosted list API)

| Case ID | Customer | Current status | Recommendation | Decisions | Handoffs | Proposed status |
|---------|----------|----------------|----------------|-----------|----------|-----------------|
| `997f45ad-f686-4724-a3c1-094d659a3741` | Meridian Systems | `awaiting_decision` | `insufficient_evidence` | none | none | `investigation_continues` |
| `4218ff91-8030-4b69-b7fa-aaa95de3f242` | Summit Workforce | `awaiting_decision` | `insufficient_evidence` | none | none | `investigation_continues` |

## Explicitly out of scope

- Orchid (`ea1437f9-…`) — `awaiting_decision` + `escalate` (correct)
- Vertex / Northstar / Cascade / Helix — `escalated` (correct; do not modify)
- Apex / Brightline / Blue Harbor — already `investigation_continues`

## Proposed update (per case)

1. `SELECT` current `support_cases.status`, recommendation, decision and handoff rows (confirm no decision/handoff).
2. `UPDATE support_cases SET status = 'investigation_continues' WHERE id = … AND status = 'awaiting_decision'`.
3. Append `case_events` row: `status_changed` with metadata `{ from: "awaiting_decision", to: "investigation_continues", reason: "Phase 1 lifecycle reconciliation for fictional demo" }`.
4. Do **not** change scores, assessments, recommendations, titles, or evidence.
5. Read back and confirm Pending reviews no longer includes these IDs by **stored** status alone.

## Safety notes

- No broad reseed; no delete/recreate.
- No changes to approved/escalated cases.
- Stop if either case unexpectedly has a decision or handoff row.

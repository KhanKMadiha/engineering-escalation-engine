# Redesign audit — Engineering Escalation Engine

This document captures the Phase 1 audit for evolving the existing application
(UI redesign + Freshdesk import). It is not a rebuild.

## Preserve

- Trust model: AI advisory → evidence validation → deterministic escalation
  engine → human-only `escalated` via `DecisionService`
- Status machine and scoring weights/thresholds
- Supabase/Postgres persistence via `CaseRepository` (memory remains for
  local/tests only)
- Handoff generation after human approval only
- Audit events on `case_events`
- Demo seed and simulated Jira/Rootly (non-network)

## Restyle targets

| Surface | Path |
|---------|------|
| App shell | `AppShell` (navy sidebar) |
| Case queue | `/` + `CaseListTable` |
| Intake | `/cases/new` + `CaseForm` |
| Case workspace | Overview / Investigation / Assessment / Handoff tabs |

## Additive work (implemented)

- Dashboard metrics from real `listCases()` data
- Freshdesk ticket import (demo provider + gated real API) — see `docs/ticket-import.md`
- Minimal schema: `source_system`, `external_ticket_id`, `external_url` (nullable)
- Presentation-only workflow stepper (status → visual stage)
- Decision-first Overview when `awaiting_decision`

## Must not change

Scoring formulas, DecisionService authority, evidence validation, handoff
approve-only gate, or removing Supabase.

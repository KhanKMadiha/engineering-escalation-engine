# Ticket import (Freshdesk)

Additive intake path for importing support tickets into existing cases.
Does not change scoring, DecisionService, or handoff gates.

## Architecture

- `TicketProvider` port: fetch by ID / list sample tickets
- `DemoFreshdeskProvider`: fictional tickets, no network (portfolio default)
- `FreshdeskProvider`: real API only when `FRESHDESK_DOMAIN` + `FRESHDESK_API_KEY`
  are set server-side; domain is fixed from env (never user-supplied host)
- `TicketImportService` → `mapTicketToCreateInput` → `CaseService` / repository create
- Read-only: no write-back to Freshdesk
- Ticket body treated as untrusted customer data (same trust boundary)

## Schema (additive)

Migration: `supabase/migrations/20261120120000_ticket_import_fields.sql`

| Column | Type | Notes |
|--------|------|--------|
| `source_system` | TEXT NULL | `manual` \| `freshdesk` \| `demo_freshdesk` |
| `external_ticket_id` | TEXT NULL | External ticket id |
| `external_url` | TEXT NULL | Optional deep link |

Unique index on `(source_system, external_ticket_id)` where both are not null.
Audit: additive event type `ticket_imported`.

## Idempotency

Re-import of the same `(source_system, external_ticket_id)` returns the existing
case rather than creating a duplicate.

-- Additive ticket import provenance for Freshdesk (and future providers).
-- Nullable so existing rows and manual creates remain valid.

ALTER TABLE support_cases
  ADD COLUMN IF NOT EXISTS source_system TEXT NULL;

ALTER TABLE support_cases
  ADD COLUMN IF NOT EXISTS external_ticket_id TEXT NULL;

ALTER TABLE support_cases
  ADD COLUMN IF NOT EXISTS external_url TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_cases_source_external
  ON support_cases (source_system, external_ticket_id)
  WHERE source_system IS NOT NULL AND external_ticket_id IS NOT NULL;

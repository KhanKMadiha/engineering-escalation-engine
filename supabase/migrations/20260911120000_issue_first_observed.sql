-- Optional approximate "issue first observed" timeframe (free text).
-- Kept separate from incident_timestamp (TIMESTAMPTZ) — never parse free text into a datetime.

ALTER TABLE support_cases
  ADD COLUMN IF NOT EXISTS issue_first_observed TEXT NULL;

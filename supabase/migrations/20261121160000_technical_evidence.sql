-- Phase B: structured technical evidence (independent of AI analysis).
-- Reversible: see matching down migration notes at end of file.
-- Do NOT apply to production without explicit approval.

-- Evidence type taxonomy (presentation + storage)
DO $$ BEGIN
  CREATE TYPE technical_evidence_type AS ENUM (
    'application_log',
    'datadog_log',
    'datadog_trace',
    'api_response',
    'postman_result',
    'auth_error',
    'screenshot',
    'attachment',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE technical_evidence_source AS ENUM (
    'customer',
    'support',
    'imported',
    'demo_fictional'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE technical_evidence_verification AS ENUM (
    'recorded',
    'support_verified',
    'unverified',
    'rejected',
    'demo_fictional'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS case_technical_evidence (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES support_cases (id) ON DELETE CASCADE,
  evidence_type technical_evidence_type NOT NULL,
  title TEXT NOT NULL,
  service TEXT NULL,
  body TEXT NULL,
  caption TEXT NULL,
  captured_at TIMESTAMPTZ NULL,
  request_id TEXT NULL,
  trace_id TEXT NULL,
  external_url TEXT NULL,
  source technical_evidence_source NOT NULL,
  verification_status technical_evidence_verification NOT NULL DEFAULT 'recorded',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT case_technical_evidence_title_len CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT case_technical_evidence_body_len CHECK (body IS NULL OR char_length(body) <= 100000),
  CONSTRAINT case_technical_evidence_caption_len CHECK (caption IS NULL OR char_length(caption) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_case_technical_evidence_case_id
  ON case_technical_evidence (case_id);
CREATE INDEX IF NOT EXISTS idx_case_technical_evidence_case_sort
  ON case_technical_evidence (case_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_case_technical_evidence_type
  ON case_technical_evidence (evidence_type);

CREATE TABLE IF NOT EXISTS case_technical_evidence_attachments (
  id UUID PRIMARY KEY,
  evidence_id UUID NOT NULL REFERENCES case_technical_evidence (id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL
    CHECK (byte_size > 0 AND byte_size <= 5242880),
  width_px INTEGER NULL,
  height_px INTEGER NULL,
  checksum_sha256 TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT case_technical_evidence_attachments_content_type_chk
    CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
  CONSTRAINT case_technical_evidence_attachments_path_uniq UNIQUE (storage_path)
);

CREATE INDEX IF NOT EXISTS idx_case_technical_evidence_attachments_evidence_id
  ON case_technical_evidence_attachments (evidence_id);

-- RLS: deny by default for anon/authenticated. Service-role bypasses RLS.
-- Application layer must still verify case existence before reads/writes.
ALTER TABLE case_technical_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_technical_evidence_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS case_technical_evidence_deny_all ON case_technical_evidence;
CREATE POLICY case_technical_evidence_deny_all
  ON case_technical_evidence
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS case_technical_evidence_attachments_deny_all
  ON case_technical_evidence_attachments;
CREATE POLICY case_technical_evidence_attachments_deny_all
  ON case_technical_evidence_attachments
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Private storage bucket for evidence screenshots (service-role uploads).
-- Only runs when Supabase Storage is available. Public URL guessing must not
-- grant access; use short-lived signed URLs from the server.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'case-evidence',
      'case-evidence',
      false,
      5242880,
      ARRAY['image/png', 'image/jpeg', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE SET
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    -- Restrictive: blocks anon/authenticated for case-evidence even if other
    -- permissive storage policies would otherwise allow the object.
    EXECUTE 'DROP POLICY IF EXISTS case_evidence_storage_deny_all ON storage.objects';
    EXECUTE $policy$
      CREATE POLICY case_evidence_storage_deny_all
        ON storage.objects
        AS RESTRICTIVE
        FOR ALL
        TO anon, authenticated
        USING (bucket_id <> 'case-evidence')
        WITH CHECK (bucket_id <> 'case-evidence')
    $policy$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Rollback (manual):
-- DROP POLICY IF EXISTS case_evidence_storage_deny_all ON storage.objects;
-- DELETE FROM storage.objects WHERE bucket_id = 'case-evidence';
-- DELETE FROM storage.buckets WHERE id = 'case-evidence';
-- DROP TABLE IF EXISTS case_technical_evidence_attachments;
-- DROP TABLE IF EXISTS case_technical_evidence;
-- DROP TYPE IF EXISTS technical_evidence_verification;
-- DROP TYPE IF EXISTS technical_evidence_source;
-- DROP TYPE IF EXISTS technical_evidence_type;
-- ---------------------------------------------------------------------------

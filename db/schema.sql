-- Skytrax Survey Campaign – Delhi Airport Admin Dashboard
-- PostgreSQL 14+ (works on Supabase, Neon, RDS, self-hosted)

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

DO $$ BEGIN
  CREATE TYPE submission_status AS ENUM ('pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Human-readable IDs: SKY-000001, SKY-000002 ...
CREATE SEQUENCE IF NOT EXISTS submission_seq START 1;

CREATE TABLE IF NOT EXISTS survey_submissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id    TEXT NOT NULL UNIQUE
                   DEFAULT ('SKY-' || lpad(nextval('submission_seq')::text, 6, '0')),
  respondent_email TEXT NOT NULL,
  passenger_name   TEXT,
  remarks          TEXT,          -- remarks entered at upload time
  admin_remarks    TEXT,          -- remarks entered during review
  status           submission_status NOT NULL DEFAULT 'pending',
  screenshot_count INTEGER NOT NULL DEFAULT 0,  -- denormalised for fast stats
  created_by       UUID REFERENCES admins(id) ON DELETE SET NULL,
  reviewed_by      UUID REFERENCES admins(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uploaded_screenshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     UUID NOT NULL REFERENCES survey_submissions(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  stored_filename   TEXT NOT NULL UNIQUE,   -- storage key of the original
  thumb_filename    TEXT,                   -- storage key of the WEBP thumbnail
  file_url          TEXT NOT NULL,          -- authenticated app URL for the original
  file_size         BIGINT NOT NULL,
  mime_type         TEXT NOT NULL,
  width             INTEGER,
  height            INTEGER,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes (sized for hundreds of thousands of rows)
DROP INDEX IF EXISTS idx_sub_created_at;
CREATE INDEX IF NOT EXISTS idx_sub_created_id   ON survey_submissions (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_sub_status_dt    ON survey_submissions (status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_sub_email        ON survey_submissions (lower(respondent_email));
CREATE INDEX IF NOT EXISTS idx_sub_email_trgm   ON survey_submissions USING gin (respondent_email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sub_name_trgm    ON survey_submissions USING gin (passenger_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shot_submission  ON uploaded_screenshots (submission_id, uploaded_at);
CREATE INDEX IF NOT EXISTS idx_shot_fname_trgm  ON uploaded_screenshots USING gin (original_filename gin_trgm_ops);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sub_updated ON survey_submissions;
CREATE TRIGGER trg_sub_updated BEFORE UPDATE ON survey_submissions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Lock tables down if running on Supabase: the app connects server-side
-- with a direct Postgres connection, so the public anon key gets nothing.
ALTER TABLE admins               ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_submissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_screenshots ENABLE ROW LEVEL SECURITY;

-- ─── Cleanup: email sending was removed from the product ───────────────
DROP INDEX IF EXISTS idx_sub_email_status;
ALTER TABLE survey_submissions
  DROP COLUMN IF EXISTS email_status, DROP COLUMN IF EXISTS email_sent_at, DROP COLUMN IF EXISTS email_error,
  DROP COLUMN IF EXISTS email_message_id, DROP COLUMN IF EXISTS email_attempts;

-- ─── Roles: 'admin' (full access) and 'viewer' (client, read-only + downloads) ───
ALTER TABLE admins ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';
DO $$ BEGIN
  ALTER TABLE admins ADD CONSTRAINT admins_role_check CHECK (role IN ('admin', 'viewer'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

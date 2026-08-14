-- ============================================================================
-- SplitMic Step 15: Website liveness checks for directory listings
-- ============================================================================
-- Run this in the Supabase SQL editor.
-- Safe to re-run (uses IF NOT EXISTS guards).
--
-- What this adds:
--   Columns to record whether each listing's website actually responds, so
--   dead leads (domain expired, site taken down) can be found and hidden from
--   the public directory instead of sitting there as unconfirmed listings.
--   Populated in batches from /admin/directory. See lib/directory/websiteCheck.ts.
--
-- Deliberately admin-only: not added to the PUBLIC_COLUMNS list in
-- lib/directory/queries.ts, and step11 already revoked the blanket SELECT for
-- anon/authenticated, so these columns stay invisible to the public role with
-- no extra GRANT needed.
-- ============================================================================

ALTER TABLE directory_businesses
  --   NULL       — never checked
  --   live       — site responded normally (2xx-3xx, or a soft 4xx like 403
  --                that's more likely bot-blocking than a dead business)
  --   dead       — domain doesn't resolve, connection refused, or a hard 404/410
  --   uncertain  — timed out, TLS error, or a 5xx — inconclusive, worth a retry
  --   no_website — no website URL on file to check
  ADD COLUMN IF NOT EXISTS website_status TEXT
    CHECK (website_status IS NULL
           OR website_status IN ('live', 'dead', 'uncertain', 'no_website')),

  ADD COLUMN IF NOT EXISTS website_http_status INTEGER,
  ADD COLUMN IF NOT EXISTS website_check_reason TEXT,
  ADD COLUMN IF NOT EXISTS website_checked_at TIMESTAMPTZ;

-- The batch job's "what still needs checking?" query.
CREATE INDEX IF NOT EXISTS idx_directory_website_check_pending
  ON directory_businesses (website_status)
  WHERE website_status IS NULL;

-- The admin panel's "which dead listings can I deactivate?" query.
CREATE INDEX IF NOT EXISTS idx_directory_website_check_dead
  ON directory_businesses (website_status)
  WHERE website_status = 'dead';

-- ============================================================================
-- Done. Verify:
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'directory_businesses'
--      AND column_name LIKE 'website_%';
--   -- expect 4 rows
--
--   SELECT count(*) FROM directory_businesses WHERE website_status IS NULL;
--   -- everything starts unchecked
-- ============================================================================

-- ============================================================================
-- SplitMic Step 12: Directory listing media
-- ============================================================================
-- Run this in the Supabase SQL editor.
-- Safe to re-run (uses IF NOT EXISTS / DROP ... IF EXISTS guards).
--
-- What this adds:
--   Screenshot columns on directory_businesses, so each listing card can show
--   a real image of that business's website instead of a flat placeholder.
--
--   Screenshots are captured from the admin screen (/admin/directory) in
--   batches via Firecrawl, stored in the existing `profile-media` bucket under
--   a directory/screenshots/ prefix, and the resulting public URL is written
--   back here.
--
-- There is deliberately no logo column: logos are derived at render time from
-- the website's favicon, so there is nothing to store or keep in sync.
-- ============================================================================

ALTER TABLE directory_businesses
  -- Public URL of the stored screenshot. NULL until one is captured; cards
  -- fall back to a brand gradient, so a partial backfill still looks intentional.
  ADD COLUMN IF NOT EXISTS screenshot_url TEXT,

  -- Tracks the capture attempt so the batch job is resumable and never pays
  -- for the same row twice:
  --   NULL     — never attempted
  --   done     — captured and stored
  --   failed   — attempted and errored (retryable by an explicit retry run)
  --   skipped  — no website URL, nothing to capture
  ADD COLUMN IF NOT EXISTS screenshot_status TEXT
    CHECK (screenshot_status IS NULL
           OR screenshot_status IN ('done', 'failed', 'skipped')),

  ADD COLUMN IF NOT EXISTS screenshot_captured_at TIMESTAMPTZ;

-- The batch job's "what still needs a screenshot?" query.
CREATE INDEX IF NOT EXISTS idx_directory_screenshot_pending
  ON directory_businesses (screenshot_status)
  WHERE screenshot_status IS NULL;

-- ── Column privileges ────────────────────────────────────────────────────
-- step11 revoked the blanket SELECT and re-granted an explicit column list, so
-- columns added later are invisible to the public role until granted here.
-- Without this the app would still work (it reads via the service role, which
-- bypasses column privileges) and the gap would only surface later, on the
-- first anon-key read. Granting now avoids that trap.
--
-- Note screenshot_captured_at is NOT granted — it's operational metadata for
-- the backfill job, not something the public page renders.
GRANT SELECT (screenshot_url, screenshot_status)
  ON directory_businesses TO anon, authenticated;

-- ============================================================================
-- Done. Verify:
--
--   -- Columns exist:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'directory_businesses'
--      AND column_name LIKE 'screenshot%';
--   -- expect: screenshot_url, screenshot_status, screenshot_captured_at
--
--   -- The public role can read the two rendered columns but still not email:
--   SELECT column_name FROM information_schema.column_privileges
--    WHERE table_name = 'directory_businesses' AND grantee = 'anon'
--    ORDER BY column_name;
--   -- expect screenshot_url + screenshot_status present, email absent
--
--   -- Everything starts unattempted:
--   SELECT count(*) FROM directory_businesses WHERE screenshot_status IS NULL;
-- ============================================================================

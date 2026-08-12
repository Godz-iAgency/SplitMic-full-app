-- ============================================================================
-- SplitMic Step 14: Free Open Graph images for directory listings
-- ============================================================================
-- Run this in the Supabase SQL editor.
-- Safe to re-run (uses IF NOT EXISTS guards).
--
-- What this adds:
--   Columns for each listing's own Open Graph preview photo — the same image
--   that shows up when its website link is shared on social/iMessage. Free:
--   no API key, no billing, just reading one meta tag off the business's own
--   page. Populated in batches from /admin/directory. See lib/directory/ogImage.ts.
--
-- Replaces the Google Places photo idea from step13 (see that file's header) —
-- Places requires a paid, billed API; this needs nothing but the website URL
-- already in the CSV import. step13's columns are left in place, unused, as
-- harmless schema history rather than dropped.
-- ============================================================================

ALTER TABLE directory_businesses
  ADD COLUMN IF NOT EXISTS og_image_url TEXT,

  --   NULL      — never looked up
  --   done      — page fetched, an image was found and stored
  --   no_image  — page fetched fine, but it has no og:image/twitter:image
  --   failed    — fetch errored (timeout, non-200, non-HTML — retryable)
  --   skipped   — no website URL to look up
  ADD COLUMN IF NOT EXISTS og_image_status TEXT
    CHECK (og_image_status IS NULL
           OR og_image_status IN ('done', 'no_image', 'failed', 'skipped')),

  ADD COLUMN IF NOT EXISTS og_image_checked_at TIMESTAMPTZ;

-- The batch job's "what still needs a lookup?" query.
CREATE INDEX IF NOT EXISTS idx_directory_og_image_pending
  ON directory_businesses (og_image_status)
  WHERE og_image_status IS NULL;

-- ── Column privileges ────────────────────────────────────────────────────
-- step11 revoked the blanket SELECT and re-granted an explicit column list, so
-- new columns stay invisible to the public role until granted here.
GRANT SELECT (og_image_url)
  ON directory_businesses TO anon, authenticated;

-- ============================================================================
-- Done. Verify:
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'directory_businesses'
--      AND column_name LIKE 'og_image%';
--   -- expect 3 rows
--
--   SELECT count(*) FROM directory_businesses WHERE og_image_status IS NULL;
--   -- everything starts unattempted
-- ============================================================================

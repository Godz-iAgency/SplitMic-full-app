-- ============================================================================
-- SplitMic Step 13: Google Places photos for directory listings
-- ============================================================================
-- Run this in the Supabase SQL editor.
-- Safe to re-run (uses IF NOT EXISTS guards).
--
-- What this adds:
--   Columns for matching each directory listing to its Google Maps place and
--   showing that place's real photo on the card — the venue interior shot you
--   see on a Google listing, rather than a screenshot of its website.
--
--   Populated in batches from /admin/directory. See lib/directory/places.ts.
--
-- On caching: Google's Places terms allow storing a place ID indefinitely, but
-- the photo URI it resolves to is short-lived. We keep the durable photo
-- *resource name* plus the last resolved URI and the time it was resolved, so
-- a refresh run can re-resolve expired URIs without re-doing the (more
-- expensive) place lookup.
-- ============================================================================

ALTER TABLE directory_businesses
  -- Durable Google identifier for the matched business.
  ADD COLUMN IF NOT EXISTS place_id TEXT,

  -- Durable photo resource name, e.g. "places/ChIJ.../photos/AeJ...".
  ADD COLUMN IF NOT EXISTS place_photo_name TEXT,

  -- Last resolved image URL. Expires; refreshed from place_photo_name.
  ADD COLUMN IF NOT EXISTS place_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS place_photo_refreshed_at TIMESTAMPTZ,

  --   NULL       — never looked up
  --   done       — matched, photo stored
  --   no_photo   — matched a place, but it has no usable photo
  --   not_found  — no confident Google match for this business name
  --   failed     — lookup errored (retryable)
  ADD COLUMN IF NOT EXISTS places_status TEXT
    CHECK (places_status IS NULL
           OR places_status IN ('done', 'no_photo', 'not_found', 'failed')),

  ADD COLUMN IF NOT EXISTS places_checked_at TIMESTAMPTZ;

-- The batch job's "what still needs a lookup?" query.
CREATE INDEX IF NOT EXISTS idx_directory_places_pending
  ON directory_businesses (places_status)
  WHERE places_status IS NULL;

-- ── Column privileges ────────────────────────────────────────────────────
-- step11 revoked the blanket SELECT and re-granted an explicit column list, so
-- new columns stay invisible to the public role until granted here. Only the
-- rendered URL is public; the place id and lookup bookkeeping are not.
GRANT SELECT (place_photo_url)
  ON directory_businesses TO anon, authenticated;

-- ============================================================================
-- Done. Verify:
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'directory_businesses'
--      AND column_name LIKE 'place%';
--   -- expect 6 rows
--
--   SELECT count(*) FROM directory_businesses WHERE places_status IS NULL;
--   -- everything starts unattempted
-- ============================================================================

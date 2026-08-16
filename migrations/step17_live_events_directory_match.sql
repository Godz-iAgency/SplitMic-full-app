-- ============================================================================
-- SplitMic Step 17: Match live events to directory venue listings
-- ============================================================================
-- Run this in the Supabase SQL editor.
-- Safe to re-run (uses IF NOT EXISTS guards).
--
-- What this adds:
--   `live_events.matched_directory_business_id` — a cross-reference to
--   `directory_businesses` (category = 'venue'), computed at sync time by
--   lib/events/matching.ts, same pattern as the existing matched_profile_id.
--   Lets an /live event card link to a real venue page (a SplitMic venue
--   profile if one exists, else this directory listing) instead of nowhere.
--
-- Deliberately independent of matched_profile_id/matched_profile_type: those
-- represent whichever of {artist, venue} matched first against real SplitMic
-- profiles (band checked before venue), so a band match can leave the venue
-- unchecked against profiles entirely. This column is always computed
-- against the directory regardless of whether a profile match happened, so
-- the card-link precedence (built at render time, not stored) can be: venue
-- profile if matched_profile_type = 'venue', else this directory match, else
-- no link.
-- ============================================================================

ALTER TABLE live_events
  ADD COLUMN IF NOT EXISTS matched_directory_business_id
    UUID REFERENCES directory_businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_live_events_matched_directory
  ON live_events (matched_directory_business_id)
  WHERE matched_directory_business_id IS NOT NULL;

-- No RLS/grant changes needed: live_events has no column-level restriction
-- (unlike directory_businesses), so this column is publicly readable the same
-- way every other live_events column already is.

-- ============================================================================
-- Done. Verify:
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'live_events'
--      AND column_name = 'matched_directory_business_id';
--   -- expect 1 row
-- ============================================================================

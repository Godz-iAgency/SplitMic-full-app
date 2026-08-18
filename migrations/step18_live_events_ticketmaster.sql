-- ============================================================================
-- SplitMic Step 18: Ticketmaster as a second live_events provider
-- ============================================================================
-- Run this in the Supabase SQL editor.
-- Safe to re-run (uses IF NOT EXISTS guards).
--
-- What this adds:
--   `live_events.genre` — Ticketmaster's classification genre (e.g. "Rock",
--   "Country"), used for the /live genre filter. Nullable: Do512 doesn't
--   scrape a genre, and every existing row stays valid.
--
-- No other schema change is needed. `source` (TEXT, default 'do512') was
-- already provider-agnostic with no CHECK constraint — Ticketmaster rows
-- just write source = 'ticketmaster'. Every other field Ticketmaster
-- supplies (name, venue, address, lat/lng, image, ticket URL) already has a
-- column shared with Do512.
-- ============================================================================

ALTER TABLE live_events
  ADD COLUMN IF NOT EXISTS genre TEXT;

-- No RLS/grant changes needed: same reasoning as step17 — live_events has no
-- column-level restriction, so this is publicly readable like every other
-- column already is.

-- ============================================================================
-- Done. Verify:
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'live_events'
--      AND column_name = 'genre';
--   -- expect 1 row
-- ============================================================================

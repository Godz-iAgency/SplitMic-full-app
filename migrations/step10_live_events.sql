-- ============================================================================
-- SplitMic Step 10: Live Events ("What's Happening Tonight")
-- ============================================================================
-- Run this in the Supabase SQL editor.
-- Safe to re-run (uses IF NOT EXISTS / DROP ... IF EXISTS guards).
--
-- What this creates:
--   live_events — Austin live-music listings scraped daily from Do512 (see
--   lib/events/), shown on the public /live page. Publicly readable (no
--   login), written only by the service-role client in the scheduled sync
--   job (app/api/cron/sync-events).
-- ============================================================================

CREATE TABLE IF NOT EXISTS live_events (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source                 TEXT NOT NULL DEFAULT 'do512',
  -- Deterministic hash of normalized (venue_name, artist_name, event_datetime) —
  -- Do512 doesn't expose a stable per-event id the way an API would, so the
  -- sync job derives one itself. See lib/events/do512.ts.
  source_event_id        TEXT NOT NULL UNIQUE,

  artist_name            TEXT NOT NULL,
  venue_name              TEXT NOT NULL,
  venue_address           TEXT,
  venue_city              TEXT NOT NULL DEFAULT 'Austin',
  venue_region             TEXT NOT NULL DEFAULT 'TX',
  -- Populated only if/when the event is geocoded; NULL is fine — the
  -- Directions/Uber buttons fall back to the address text.
  venue_latitude            NUMERIC(9,6),
  venue_longitude           NUMERIC(9,6),

  event_datetime             TIMESTAMPTZ NOT NULL,
  is_free                     BOOLEAN,
  image_url                  TEXT,
  ticket_url                  TEXT,

  -- Cross-reference to an existing published SplitMic profile, computed at
  -- sync time by lib/events/matching.ts. NULL when no confident match.
  matched_profile_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  matched_profile_type         TEXT CHECK (matched_profile_type IN ('band', 'venue')),

  -- Full scraped object, for debugging/reprocessing without re-scraping.
  raw_payload                    JSONB,

  -- False once Do512 stops listing a previously-seen future event
  -- (cancelled/removed). Never flipped back to true by a later sync — a
  -- deactivated row is just left alone if it resurfaces, a new row is made.
  is_active                       BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at                         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public read query: today / this week, active only, soonest first.
CREATE INDEX IF NOT EXISTS idx_live_events_upcoming
  ON live_events (event_datetime) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_live_events_matched_profile
  ON live_events (matched_profile_id) WHERE matched_profile_id IS NOT NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE live_events ENABLE ROW LEVEL SECURITY;

-- Public, unauthenticated read of active events only — this is the entire
-- point of the feature (guest-crawlable content for "Austin live music"
-- search intent). No INSERT/UPDATE/DELETE policy at all: writes only ever
-- happen via the service-role client in the cron sync job, which bypasses
-- RLS entirely.
DROP POLICY IF EXISTS "live_events_public_read" ON live_events;
CREATE POLICY "live_events_public_read" ON live_events
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

-- ============================================================================
-- Done. Test (as service role, e.g. via the SQL editor which bypasses RLS):
--
--   INSERT INTO live_events (source_event_id, artist_name, venue_name,
--     venue_address, event_datetime)
--   VALUES ('test-hash-1', 'Test Band', 'Mohawk Austin',
--     '912 Red River St, Austin, TX', NOW() + INTERVAL '3 hours');
--
--   -- As anon: should return the row above.
--   SELECT * FROM live_events WHERE is_active = TRUE;
-- ============================================================================

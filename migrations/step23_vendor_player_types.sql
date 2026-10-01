-- ============================================================================
-- SplitMic Step 23: Gear & services player types
-- ============================================================================
-- Run this in Supabase SQL Editor BEFORE deploying the code that ships with it
-- (the app writes these player types and reads these tables). Safe to re-run.
--
-- Adds three player types for the businesses that serve a show: backline
-- companies, instrument rental, and rehearsal studios (PROGRESS.md §2 #27).
-- They sign up and get a profile like everyone else, but they never post to
-- the feed and reach people through a Connect request, the same way a band
-- does. Existing rows are not touched.
--
-- What this changes:
--   1. player_type enum   — three new values.
--   2. Three detail tables — backline_details, instrument_rental_details,
--                            rehearsal_studio_details, with RLS matching the
--                            existing detail tables as measured live: readable
--                            when the profile is published (or by its owner),
--                            writable only by the owner, for their own profile.
--   3. marketplace_posts   — "anyone who isn't a band can post" becomes an
--                            explicit list of the four posting types.
--   4. message_threads     — "anyone who isn't a band can open a thread
--                            directly" becomes the same explicit list.
--   5. open_mic_signups    — only a band profile can sign up to perform. The
--                            app already enforced this; the database didn't.
--
-- Why 3 and 4 matter: both rules were written as "player_type <> 'band'",
-- which was correct while band was the only non-industry type. The moment a
-- backline company exists it would pass that test, so a direct API call could
-- post to the feed or DM anyone instantly, both of which the app forbids.
--
-- A note on the enum: Postgres won't let a value added by ALTER TYPE be used
-- in the same transaction it was added in. Nothing below spells a new value as
-- an enum literal: the posting and thread rules only list existing values,
-- and the detail tables compare player_type::text, which is plain text.
-- ============================================================================

-- ── 1. player_type enum ─────────────────────────────────────────────────────

ALTER TYPE public.player_type ADD VALUE IF NOT EXISTS 'backline';
ALTER TYPE public.player_type ADD VALUE IF NOT EXISTS 'instrument_rental';
ALTER TYPE public.player_type ADD VALUE IF NOT EXISTS 'rehearsal_studio';

-- ── 2. Detail tables ────────────────────────────────────────────────────────
-- Same skeleton as band_details and the rest: one row per profile (the app
-- upserts on profile_id), owner id alongside it, cascading deletes so removing
-- an account never trips over a leftover row. Chip lists are stored as their
-- option slugs (lib/profile/vendorOptions.ts) and filtered to that list by the
-- app before every write. Pricing is free text on purpose, never a number.

CREATE TABLE IF NOT EXISTS backline_details (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name  TEXT NOT NULL CHECK (char_length(business_name) <= 120),
  equipment      TEXT[] NOT NULL DEFAULT '{}',
  delivers       BOOLEAN,
  service_area   TEXT CHECK (service_area IS NULL OR char_length(service_area) <= 120),
  price_note     TEXT CHECK (price_note IS NULL OR char_length(price_note) <= 200),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS instrument_rental_details (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name   TEXT NOT NULL CHECK (char_length(business_name) <= 120),
  instruments     TEXT[] NOT NULL DEFAULT '{}',
  rental_periods  TEXT[] NOT NULL DEFAULT '{}',
  delivers        BOOLEAN,
  price_note      TEXT CHECK (price_note IS NULL OR char_length(price_note) <= 200),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rehearsal_studio_details (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id           UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name        TEXT NOT NULL CHECK (char_length(business_name) <= 120),
  room_count           INTEGER CHECK (room_count IS NULL OR room_count >= 0),
  gear_included        TEXT[] NOT NULL DEFAULT '{}',
  rate_note            TEXT CHECK (rate_note IS NULL OR char_length(rate_note) <= 200),
  max_people_per_room  INTEGER CHECK (max_people_per_room IS NULL OR max_people_per_room >= 0),
  hours_note           TEXT CHECK (hours_note IS NULL OR char_length(hours_note) <= 200),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Least privilege: the public key reads, a signed-in user writes (RLS then
-- narrows both to the right rows). Every column here is meant to be public,
-- so no column-level grant is needed (contrast step11's directory table).
REVOKE ALL ON backline_details, instrument_rental_details, rehearsal_studio_details
  FROM anon, authenticated;
GRANT SELECT ON backline_details, instrument_rental_details, rehearsal_studio_details
  TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE
  ON backline_details, instrument_rental_details, rehearsal_studio_details
  TO authenticated;

ALTER TABLE backline_details          ENABLE ROW LEVEL SECURITY;
ALTER TABLE instrument_rental_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehearsal_studio_details  ENABLE ROW LEVEL SECURITY;

-- One set of four policies per table, identical apart from the table and its
-- player type. Written out rather than generated so each reads on its own.

-- backline_details
DROP POLICY IF EXISTS "backline_details_read" ON backline_details;
CREATE POLICY "backline_details_read" ON backline_details
  FOR SELECT TO anon, authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (SELECT id FROM profiles WHERE is_published = TRUE)
  );

DROP POLICY IF EXISTS "backline_details_owner_insert" ON backline_details;
CREATE POLICY "backline_details_owner_insert" ON backline_details
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND profile_id IN (
      SELECT id FROM profiles
       WHERE user_id = auth.uid() AND player_type::text = 'backline'
    )
  );

DROP POLICY IF EXISTS "backline_details_owner_update" ON backline_details;
CREATE POLICY "backline_details_owner_update" ON backline_details
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND profile_id IN (
      SELECT id FROM profiles
       WHERE user_id = auth.uid() AND player_type::text = 'backline'
    )
  );

DROP POLICY IF EXISTS "backline_details_owner_delete" ON backline_details;
CREATE POLICY "backline_details_owner_delete" ON backline_details
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- instrument_rental_details
DROP POLICY IF EXISTS "instrument_rental_details_read" ON instrument_rental_details;
CREATE POLICY "instrument_rental_details_read" ON instrument_rental_details
  FOR SELECT TO anon, authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (SELECT id FROM profiles WHERE is_published = TRUE)
  );

DROP POLICY IF EXISTS "instrument_rental_details_owner_insert" ON instrument_rental_details;
CREATE POLICY "instrument_rental_details_owner_insert" ON instrument_rental_details
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND profile_id IN (
      SELECT id FROM profiles
       WHERE user_id = auth.uid() AND player_type::text = 'instrument_rental'
    )
  );

DROP POLICY IF EXISTS "instrument_rental_details_owner_update" ON instrument_rental_details;
CREATE POLICY "instrument_rental_details_owner_update" ON instrument_rental_details
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND profile_id IN (
      SELECT id FROM profiles
       WHERE user_id = auth.uid() AND player_type::text = 'instrument_rental'
    )
  );

DROP POLICY IF EXISTS "instrument_rental_details_owner_delete" ON instrument_rental_details;
CREATE POLICY "instrument_rental_details_owner_delete" ON instrument_rental_details
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- rehearsal_studio_details
DROP POLICY IF EXISTS "rehearsal_studio_details_read" ON rehearsal_studio_details;
CREATE POLICY "rehearsal_studio_details_read" ON rehearsal_studio_details
  FOR SELECT TO anon, authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (SELECT id FROM profiles WHERE is_published = TRUE)
  );

DROP POLICY IF EXISTS "rehearsal_studio_details_owner_insert" ON rehearsal_studio_details;
CREATE POLICY "rehearsal_studio_details_owner_insert" ON rehearsal_studio_details
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND profile_id IN (
      SELECT id FROM profiles
       WHERE user_id = auth.uid() AND player_type::text = 'rehearsal_studio'
    )
  );

DROP POLICY IF EXISTS "rehearsal_studio_details_owner_update" ON rehearsal_studio_details;
CREATE POLICY "rehearsal_studio_details_owner_update" ON rehearsal_studio_details
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND profile_id IN (
      SELECT id FROM profiles
       WHERE user_id = auth.uid() AND player_type::text = 'rehearsal_studio'
    )
  );

DROP POLICY IF EXISTS "rehearsal_studio_details_owner_delete" ON rehearsal_studio_details;
CREATE POLICY "rehearsal_studio_details_owner_delete" ON rehearsal_studio_details
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── 3. marketplace_posts: only the four posting types can post ──────────────
-- Same as step22's policy except the type test, which is now an allowlist.
DROP POLICY IF EXISTS "mp_posts_owner_insert" ON marketplace_posts;
CREATE POLICY "mp_posts_owner_insert" ON marketplace_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    poster_user_id = auth.uid()
    AND poster_profile_id IN (
      SELECT id FROM profiles
       WHERE user_id = auth.uid()
         AND player_type IN ('venue', 'talent_buyer', 'record_label', 'festival')
         AND is_suspended = FALSE
    )
  );

-- ── 4. message_threads: only the four industry types skip Connect ───────────
-- Same as step22's policy except the type test. Everyone else (bands, and now
-- the gear/rehearsal businesses) needs an accepted connection first, and the
-- accept trigger (SECURITY DEFINER, step20) still opens that thread itself.
DROP POLICY IF EXISTS "mt_party_insert" ON message_threads;
CREATE POLICY "mt_party_insert" ON message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_a_id = auth.uid() OR user_b_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.is_suspended = FALSE
    )
    AND (
      EXISTS (
        SELECT 1 FROM profiles p
         WHERE p.user_id = auth.uid()
           AND p.player_type IN ('venue', 'talent_buyer', 'record_label', 'festival')
      )
      OR EXISTS (
        SELECT 1 FROM connection_requests cr
         WHERE cr.status = 'accepted'
           AND (
             (cr.requester_profile_id = profile_a_id AND cr.recipient_profile_id = profile_b_id)
             OR (cr.requester_profile_id = profile_b_id AND cr.recipient_profile_id = profile_a_id)
           )
      )
    )
  );

-- ── 5. open_mic_signups: only bands sign up to perform ──────────────────────
-- Same as step8's policy plus the type test. app/opportunities/actions.ts
-- already refused non-bands; this makes the database agree.
DROP POLICY IF EXISTS "oms_band_insert" ON open_mic_signups;
CREATE POLICY "oms_band_insert" ON open_mic_signups
  FOR INSERT TO authenticated
  WITH CHECK (
    band_user_id = auth.uid()
    AND band_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND player_type = 'band'
    )
    AND post_id IN (
      SELECT id FROM marketplace_posts WHERE post_type = 'open_mic'
    )
  );

-- Make the new tables visible to the API right away.
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Done. To verify afterward:
--
--   -- The three new values are on the enum (expect 8 rows):
--   select unnest(enum_range(null::player_type));
--
--   -- No policy still uses the old "not a band" test (expect zero rows):
--   select tablename, policyname from pg_policies
--    where schemaname = 'public'
--      and (qual ilike '%<> ''band''%' or with_check ilike '%<> ''band''%');
--
--   -- RLS is on for the new tables (expect three rows, all true):
--   select relname, relrowsecurity from pg_class
--    where relname in ('backline_details', 'instrument_rental_details',
--                      'rehearsal_studio_details');
-- ============================================================================

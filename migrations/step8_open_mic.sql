-- ============================================================================
-- SplitMic Step 8: Open Mic Signups
-- ============================================================================
-- Run this in the Supabase SQL editor.
-- Safe to re-run (uses IF NOT EXISTS / DROP ... IF EXISTS guards).
--
-- What this creates:
--   1. A new 'open_mic' post_type on marketplace_posts (venues only, in app)
--   2. open_mic_signups — bands sign up for a venue's open mic; venue controls
--      the running order (sort_order) and check-in status
--   3. Auto sort_order assignment, RLS policies, indexes
--
-- Also backfills a guarded event_end_date column so a from-scratch run of the
-- migration files produces the same schema the live database already has.
-- ============================================================================

-- ── 0. Schema reconciliation ────────────────────────────────────────────────
-- event_end_date was added to the live DB directly (multi-day festivals) but
-- never captured in a migration file. This no-ops on the live DB and makes a
-- clean rebuild match. See PROGRESS.md.
ALTER TABLE marketplace_posts
  ADD COLUMN IF NOT EXISTS event_end_date DATE;

-- ── 1. Allow 'open_mic' as a post_type ──────────────────────────────────────
-- Widen the post_type CHECK and the date-required CHECK to cover open mics.
-- Open mics behave like events: they have a specific date and expire 7 days
-- after it.
ALTER TABLE marketplace_posts
  DROP CONSTRAINT IF EXISTS marketplace_posts_post_type_check;
ALTER TABLE marketplace_posts
  ADD CONSTRAINT marketplace_posts_post_type_check
  CHECK (post_type IN ('event', 'opportunity', 'open_mic'));

ALTER TABLE marketplace_posts
  DROP CONSTRAINT IF EXISTS event_requires_date;
ALTER TABLE marketplace_posts
  ADD CONSTRAINT event_requires_date
  CHECK (post_type NOT IN ('event', 'open_mic') OR event_date IS NOT NULL);

-- Expiry trigger: open mics + events expire 7 days after the event date
-- (or the end date, for multi-day festivals). Opportunities use open_until.
CREATE OR REPLACE FUNCTION marketplace_posts_compute_expires()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.post_type IN ('event', 'open_mic') THEN
    NEW.expires_at := COALESCE(NEW.event_end_date, NEW.event_date) + INTERVAL '7 days';
  ELSIF NEW.post_type = 'opportunity' THEN
    NEW.expires_at := NEW.open_until + INTERVAL '7 days';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 2. open_mic_signups ─────────────────────────────────────────────────────
-- One row per band that signs up for an open mic post. sort_order is the
-- running order the venue sees (and can reorder). status tracks check-in.
CREATE TABLE IF NOT EXISTS open_mic_signups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id           UUID NOT NULL REFERENCES marketplace_posts(id) ON DELETE CASCADE,
  band_profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  band_user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'signed_up'
                      CHECK (status IN ('signed_up', 'checked_in', 'no_show')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One signup per band per open mic
  UNIQUE (post_id, band_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_open_mic_signups_post
  ON open_mic_signups (post_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_open_mic_signups_band
  ON open_mic_signups (band_profile_id);

-- ── 3. Trigger: append new signups to the end of the running order ──────────
-- When a band signs up without an explicit position (sort_order 0/NULL), put
-- them last. Venue can reorder afterward.
CREATE OR REPLACE FUNCTION open_mic_signups_assign_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sort_order IS NULL OR NEW.sort_order = 0 THEN
    SELECT COALESCE(MAX(sort_order), 0) + 1
      INTO NEW.sort_order
      FROM open_mic_signups
     WHERE post_id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_open_mic_signups_order ON open_mic_signups;
CREATE TRIGGER trg_open_mic_signups_order
  BEFORE INSERT ON open_mic_signups
  FOR EACH ROW EXECUTE FUNCTION open_mic_signups_assign_order();

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE open_mic_signups ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user can see a lineup (public running order + count).
DROP POLICY IF EXISTS "oms_read" ON open_mic_signups;
CREATE POLICY "oms_read" ON open_mic_signups
  FOR SELECT TO authenticated
  USING (TRUE);

-- Insert: a band signs up itself, only on an open_mic post.
DROP POLICY IF EXISTS "oms_band_insert" ON open_mic_signups;
CREATE POLICY "oms_band_insert" ON open_mic_signups
  FOR INSERT TO authenticated
  WITH CHECK (
    band_user_id = auth.uid()
    AND band_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND post_id IN (
      SELECT id FROM marketplace_posts WHERE post_type = 'open_mic'
    )
  );

-- Delete: a band can withdraw its own signup; the venue (post owner) can
-- remove any band from its open mic.
DROP POLICY IF EXISTS "oms_delete" ON open_mic_signups;
CREATE POLICY "oms_delete" ON open_mic_signups
  FOR DELETE TO authenticated
  USING (
    band_user_id = auth.uid()
    OR post_id IN (
      SELECT id FROM marketplace_posts WHERE poster_user_id = auth.uid()
    )
  );

-- Update: only the venue (post owner) reorders / checks bands in.
DROP POLICY IF EXISTS "oms_venue_update" ON open_mic_signups;
CREATE POLICY "oms_venue_update" ON open_mic_signups
  FOR UPDATE TO authenticated
  USING (
    post_id IN (
      SELECT id FROM marketplace_posts WHERE poster_user_id = auth.uid()
    )
  )
  WITH CHECK (
    post_id IN (
      SELECT id FROM marketplace_posts WHERE poster_user_id = auth.uid()
    )
  );

-- ============================================================================
-- Done. Test:
--
--   -- As a venue, create an open mic:
--   INSERT INTO marketplace_posts (poster_profile_id, poster_user_id,
--     post_type, title, event_date, event_location, expires_at)
--   VALUES ('<venue profile id>', '<venue user id>',
--     'open_mic', 'Tuesday Open Mic', '2026-08-01', 'Mohawk Austin',
--     '2026-08-08');
--
--   -- As a band, sign up (sort_order auto-assigned):
--   INSERT INTO open_mic_signups (post_id, band_profile_id, band_user_id)
--   VALUES ('<post id>', '<band profile id>', '<band user id>');
-- ============================================================================

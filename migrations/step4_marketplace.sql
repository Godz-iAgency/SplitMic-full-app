-- ============================================================================
-- SplitMic Step 4: Opportunities Marketplace
-- ============================================================================
-- Run this in the Supabase SQL editor.
-- Safe to re-run (uses IF NOT EXISTS / DROP POLICY IF EXISTS guards).
--
-- What this creates:
--   1. marketplace_posts        — events + opportunities posted by industry players
--   2. event_band_tags          — bands tagged on event posts (accept/decline + share)
--   3. connection_requests      — long-term Connect requests + post-response requests
--   4. RLS policies, indexes, expiration helpers
-- ============================================================================

-- ── 1. marketplace_posts ─────────────────────────────────────────────────────
-- One table for both event posts and opportunity posts. Differentiated by
-- post_type. Bands cannot post (enforced in app + RLS via player_type check).
CREATE TABLE IF NOT EXISTS marketplace_posts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_profile_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  poster_user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_type             TEXT NOT NULL CHECK (post_type IN ('event', 'opportunity')),
  title                 TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description           TEXT CHECK (description IS NULL OR char_length(description) <= 2000),

  -- Event-specific (required when post_type = 'event')
  event_date            DATE,
  event_location        TEXT,

  -- Opportunity-specific (required when post_type = 'opportunity')
  open_until            DATE,

  -- Common
  genres                TEXT[] NOT NULL DEFAULT '{}',
  pay_info              TEXT,
  player_types_wanted   TEXT[] NOT NULL DEFAULT '{}',

  -- Auto-computed by trigger: event_date + 7 OR open_until + 7
  expires_at            DATE NOT NULL,

  is_active             BOOLEAN NOT NULL DEFAULT TRUE,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT event_requires_date CHECK (
    post_type <> 'event' OR event_date IS NOT NULL
  ),
  CONSTRAINT opportunity_requires_open_until CHECK (
    post_type <> 'opportunity' OR open_until IS NOT NULL
  )
);

-- Trigger: compute expires_at from event_date or open_until + 7 days
CREATE OR REPLACE FUNCTION marketplace_posts_compute_expires()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.post_type = 'event' THEN
    NEW.expires_at := NEW.event_date + INTERVAL '7 days';
  ELSIF NEW.post_type = 'opportunity' THEN
    NEW.expires_at := NEW.open_until + INTERVAL '7 days';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marketplace_posts_expires ON marketplace_posts;
CREATE TRIGGER trg_marketplace_posts_expires
  BEFORE INSERT OR UPDATE ON marketplace_posts
  FOR EACH ROW EXECUTE FUNCTION marketplace_posts_compute_expires();

-- Indexes for the browse feed
CREATE INDEX IF NOT EXISTS idx_marketplace_posts_active_expires
  ON marketplace_posts (is_active, expires_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_posts_type
  ON marketplace_posts (post_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_posts_poster
  ON marketplace_posts (poster_profile_id);

-- ── 2. event_band_tags ───────────────────────────────────────────────────────
-- Bands tagged on a venue/festival event post. Each tagged band can accept,
-- decline, and (if accepted) share to their own feed.
CREATE TABLE IF NOT EXISTS event_band_tags (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_post_id   UUID NOT NULL REFERENCES marketplace_posts(id) ON DELETE CASCADE,
  band_profile_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tagged_by_user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'declined')),
  shared_to_feed        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at          TIMESTAMPTZ,
  UNIQUE (marketplace_post_id, band_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_event_band_tags_band
  ON event_band_tags (band_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_event_band_tags_post
  ON event_band_tags (marketplace_post_id);
CREATE INDEX IF NOT EXISTS idx_event_band_tags_shared
  ON event_band_tags (shared_to_feed) WHERE shared_to_feed = TRUE;

-- ── 3. connection_requests ──────────────────────────────────────────────────
-- Two flavors:
--   request_type = 'connection'    : long-term Connect (cold outreach)
--   request_type = 'post_response' : tied to a marketplace post — opens a
--                                    conversation just about that opportunity
CREATE TABLE IF NOT EXISTS connection_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requester_user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  request_type            TEXT NOT NULL
                            CHECK (request_type IN ('connection', 'post_response')),
  related_post_id         UUID REFERENCES marketplace_posts(id) ON DELETE SET NULL,

  message                 TEXT CHECK (message IS NULL OR char_length(message) <= 500),

  status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'accepted', 'declined')),

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at            TIMESTAMPTZ,

  -- Cannot request yourself
  CONSTRAINT no_self_request CHECK (requester_profile_id <> recipient_profile_id)
);

-- Prevent duplicate pending connection requests for the same long-term Connect
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_connection
  ON connection_requests (requester_profile_id, recipient_profile_id, request_type)
  WHERE status = 'pending' AND request_type = 'connection';

-- Prevent duplicate pending responses to the same post by the same responder
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_post_response
  ON connection_requests (requester_profile_id, related_post_id)
  WHERE status = 'pending' AND request_type = 'post_response';

CREATE INDEX IF NOT EXISTS idx_conn_req_recipient
  ON connection_requests (recipient_profile_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conn_req_requester
  ON connection_requests (requester_profile_id, status, created_at DESC);

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE marketplace_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_band_tags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_requests  ENABLE ROW LEVEL SECURITY;

-- marketplace_posts: anyone authenticated can read active+unexpired posts;
-- owners can read/insert/update/delete their own.
DROP POLICY IF EXISTS "mp_posts_read_active" ON marketplace_posts;
CREATE POLICY "mp_posts_read_active" ON marketplace_posts
  FOR SELECT TO authenticated
  USING (is_active = TRUE AND expires_at >= CURRENT_DATE);

DROP POLICY IF EXISTS "mp_posts_owner_read" ON marketplace_posts;
CREATE POLICY "mp_posts_owner_read" ON marketplace_posts
  FOR SELECT TO authenticated
  USING (poster_user_id = auth.uid());

DROP POLICY IF EXISTS "mp_posts_owner_insert" ON marketplace_posts;
CREATE POLICY "mp_posts_owner_insert" ON marketplace_posts
  FOR INSERT TO authenticated
  WITH CHECK (poster_user_id = auth.uid());

DROP POLICY IF EXISTS "mp_posts_owner_update" ON marketplace_posts;
CREATE POLICY "mp_posts_owner_update" ON marketplace_posts
  FOR UPDATE TO authenticated
  USING (poster_user_id = auth.uid());

DROP POLICY IF EXISTS "mp_posts_owner_delete" ON marketplace_posts;
CREATE POLICY "mp_posts_owner_delete" ON marketplace_posts
  FOR DELETE TO authenticated
  USING (poster_user_id = auth.uid());

-- event_band_tags: tagged band can read + update theirs; poster can read + insert.
-- Public (authenticated) can read accepted tags on active posts (so card shows lineup).
DROP POLICY IF EXISTS "ebt_band_read" ON event_band_tags;
CREATE POLICY "ebt_band_read" ON event_band_tags
  FOR SELECT TO authenticated
  USING (
    band_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR marketplace_post_id IN (
      SELECT id FROM marketplace_posts WHERE poster_user_id = auth.uid()
    )
    OR (status = 'accepted' AND marketplace_post_id IN (
      SELECT id FROM marketplace_posts
       WHERE is_active = TRUE AND expires_at >= CURRENT_DATE
    ))
  );

DROP POLICY IF EXISTS "ebt_poster_insert" ON event_band_tags;
CREATE POLICY "ebt_poster_insert" ON event_band_tags
  FOR INSERT TO authenticated
  WITH CHECK (
    tagged_by_user_id = auth.uid()
    AND marketplace_post_id IN (
      SELECT id FROM marketplace_posts WHERE poster_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ebt_band_update" ON event_band_tags;
CREATE POLICY "ebt_band_update" ON event_band_tags
  FOR UPDATE TO authenticated
  USING (band_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "ebt_poster_delete" ON event_band_tags;
CREATE POLICY "ebt_poster_delete" ON event_band_tags
  FOR DELETE TO authenticated
  USING (
    marketplace_post_id IN (
      SELECT id FROM marketplace_posts WHERE poster_user_id = auth.uid()
    )
  );

-- connection_requests: both parties can read; requester inserts; recipient updates.
DROP POLICY IF EXISTS "cr_party_read" ON connection_requests;
CREATE POLICY "cr_party_read" ON connection_requests
  FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid() OR recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "cr_requester_insert" ON connection_requests;
CREATE POLICY "cr_requester_insert" ON connection_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester_user_id = auth.uid());

DROP POLICY IF EXISTS "cr_recipient_update" ON connection_requests;
CREATE POLICY "cr_recipient_update" ON connection_requests
  FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid());

-- ── 5. Soft expiration job (called by app on read) ──────────────────────────
-- We do not need pg_cron — the browse query already filters by expires_at.
-- A periodic hard-delete can be wired later via a Supabase Edge Function.
-- For now, expired rows simply stop appearing; they can be hard-deleted with:
--
--   DELETE FROM marketplace_posts WHERE expires_at < CURRENT_DATE;
--
-- Schedule that as a daily Supabase scheduled task when ready.

-- ============================================================================
-- Done. Test by inserting a row:
--
--   INSERT INTO marketplace_posts (poster_profile_id, poster_user_id,
--     post_type, title, event_date, event_location, expires_at)
--   VALUES ('<a venue profile id>', '<that user id>',
--     'event', 'Test Friday Night', '2026-06-15', 'Mohawk Austin',
--     '2026-06-22');
-- ============================================================================

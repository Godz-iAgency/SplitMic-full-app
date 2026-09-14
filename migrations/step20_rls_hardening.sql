-- ============================================================================
-- SplitMic Step 20: RLS hardening (marketplace, connections, messaging)
-- ============================================================================
-- Run this in Supabase SQL Editor. Safe to re-run.
--
-- Closes gaps found in a full-app audit (see AUDIT.md, PROGRESS.md §2 #23a):
-- checked-in RLS let a caller satisfy an INSERT/UPDATE policy while writing
-- values the app itself would never allow, because a *_user_id check alone
-- doesn't confirm the paired *_profile_id actually belongs to that user, and
-- several UPDATE policies had no WITH CHECK at all — Postgres RLS can't
-- compare old vs. new column values in a WITH CHECK, so those are closed
-- here with a BEFORE UPDATE trigger per table instead.
--
-- Everything below only constrains *future* writes. No existing row is
-- touched, read, or re-validated, so this cannot break or hide any data
-- that's already there.
--
-- What this changes:
--   1. marketplace_posts   — insert now binds poster_profile_id to the
--                            caller and blocks bands from posting (the rule
--                            step4's own comment already claimed existed).
--                            Owner identity locked on update.
--   2. connection_requests — insert now binds requester_profile_id to the
--                            caller. Update locked to status-only, and only
--                            while the request is still pending.
--   3. message_threads     — insert now requires an accepted connection
--                            between the two profiles (previously any two
--                            user ids could open a thread with each other
--                            directly, bypassing Connect entirely). The
--                            trigger that legitimately creates a thread on
--                            accept is made SECURITY DEFINER so it keeps
--                            working — it bypasses this policy by running as
--                            the table owner, same as it always effectively
--                            needed to. Thread participants locked on update.
--   4. dm_messages         — update locked so only read_at can ever change;
--                            a thread party could otherwise rewrite another
--                            party's message body while marking it read.
-- ============================================================================

-- ── 1. marketplace_posts ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "mp_posts_owner_insert" ON marketplace_posts;
CREATE POLICY "mp_posts_owner_insert" ON marketplace_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    poster_user_id = auth.uid()
    AND poster_profile_id IN (
      SELECT id FROM profiles
       WHERE user_id = auth.uid() AND player_type <> 'band'
    )
  );

CREATE OR REPLACE FUNCTION lock_marketplace_post_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.poster_profile_id <> OLD.poster_profile_id
     OR NEW.poster_user_id <> OLD.poster_user_id THEN
    RAISE EXCEPTION 'poster_profile_id and poster_user_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_marketplace_post_owner ON marketplace_posts;
CREATE TRIGGER trg_lock_marketplace_post_owner
  BEFORE UPDATE ON marketplace_posts
  FOR EACH ROW EXECUTE FUNCTION lock_marketplace_post_owner();

-- ── 2. connection_requests ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "cr_requester_insert" ON connection_requests;
CREATE POLICY "cr_requester_insert" ON connection_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_user_id = auth.uid()
    AND requester_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- The recipient may only flip status once, pending -> accepted/declined.
-- Runs alongside the existing trg_connection_request_accept (fires first,
-- alphabetically, and only ever touches responded_at, which this trigger
-- doesn't lock) so accepting still works exactly as before.
CREATE OR REPLACE FUNCTION lock_connection_request_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.requester_profile_id <> OLD.requester_profile_id
     OR NEW.requester_user_id <> OLD.requester_user_id
     OR NEW.recipient_profile_id <> OLD.recipient_profile_id
     OR NEW.recipient_user_id <> OLD.recipient_user_id
     OR NEW.request_type <> OLD.request_type
     OR NEW.message IS DISTINCT FROM OLD.message
     OR NEW.related_post_id IS DISTINCT FROM OLD.related_post_id THEN
    RAISE EXCEPTION 'only status may be changed on an existing connection request';
  END IF;
  IF NEW.status <> OLD.status AND OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'a connection request can only be responded to once';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_connection_request_fields ON connection_requests;
CREATE TRIGGER trg_lock_connection_request_fields
  BEFORE UPDATE ON connection_requests
  FOR EACH ROW EXECUTE FUNCTION lock_connection_request_fields();

-- ── 3. message_threads ───────────────────────────────────────────────────────

-- Re-declared with SECURITY DEFINER (and dm_messages, its current live name
-- — step5_messaging.sql still says "messages", the table was renamed outside
-- any migration file). Table owners bypass RLS by default, so this function's
-- own inserts into message_threads/dm_messages keep working once the insert
-- policy below is tightened to require an accepted connection.
CREATE OR REPLACE FUNCTION on_connection_request_accept()
RETURNS TRIGGER AS $$
DECLARE
  smaller_pid UUID;
  larger_pid  UUID;
  smaller_uid UUID;
  larger_uid  UUID;
  thread_id_var UUID;
BEGIN
  IF NEW.status <> 'pending' AND OLD.status = 'pending' THEN
    NEW.responded_at := NOW();
  END IF;

  IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    IF NEW.requester_profile_id < NEW.recipient_profile_id THEN
      smaller_pid := NEW.requester_profile_id;
      larger_pid  := NEW.recipient_profile_id;
      smaller_uid := NEW.requester_user_id;
      larger_uid  := NEW.recipient_user_id;
    ELSE
      smaller_pid := NEW.recipient_profile_id;
      larger_pid  := NEW.requester_profile_id;
      smaller_uid := NEW.recipient_user_id;
      larger_uid  := NEW.requester_user_id;
    END IF;

    INSERT INTO message_threads
      (profile_a_id, profile_b_id, user_a_id, user_b_id)
    VALUES (smaller_pid, larger_pid, smaller_uid, larger_uid)
    ON CONFLICT (profile_a_id, profile_b_id) DO NOTHING
    RETURNING id INTO thread_id_var;

    IF thread_id_var IS NULL THEN
      SELECT id INTO thread_id_var
        FROM message_threads
       WHERE profile_a_id = smaller_pid AND profile_b_id = larger_pid;
    END IF;

    IF NEW.message IS NOT NULL AND char_length(NEW.message) > 0 THEN
      INSERT INTO dm_messages (thread_id, sender_profile_id, sender_user_id, body)
      VALUES (thread_id_var, NEW.requester_profile_id, NEW.requester_user_id, NEW.message);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Previously any two user ids could form a thread directly against the API
-- with no Connect request involved at all. Now requires an accepted
-- connection between the two profiles first — the trigger above is the only
-- path that still works without one, since it bypasses this policy entirely.
DROP POLICY IF EXISTS "mt_party_insert" ON message_threads;
CREATE POLICY "mt_party_insert" ON message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_a_id = auth.uid() OR user_b_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM connection_requests cr
       WHERE cr.status = 'accepted'
         AND (
           (cr.requester_profile_id = profile_a_id AND cr.recipient_profile_id = profile_b_id)
           OR (cr.requester_profile_id = profile_b_id AND cr.recipient_profile_id = profile_a_id)
         )
    )
  );

CREATE OR REPLACE FUNCTION lock_message_thread_parties()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.profile_a_id <> OLD.profile_a_id OR NEW.profile_b_id <> OLD.profile_b_id
     OR NEW.user_a_id <> OLD.user_a_id OR NEW.user_b_id <> OLD.user_b_id THEN
    RAISE EXCEPTION 'thread participants cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_message_thread_parties ON message_threads;
CREATE TRIGGER trg_lock_message_thread_parties
  BEFORE UPDATE ON message_threads
  FOR EACH ROW EXECUTE FUNCTION lock_message_thread_parties();

-- ── 4. dm_messages ───────────────────────────────────────────────────────────

-- dm_recipient_mark_read's USING clause correctly scopes *which* messages a
-- party can touch; it never restricted *what* about them can change. Without
-- this, marking a message read could, via a raw API call, silently rewrite
-- its body, sender, or thread instead.
CREATE OR REPLACE FUNCTION lock_dm_message_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.thread_id <> OLD.thread_id
     OR NEW.sender_profile_id <> OLD.sender_profile_id
     OR NEW.sender_user_id <> OLD.sender_user_id
     OR NEW.body <> OLD.body
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'only read_at may be changed on an existing message';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_dm_message_fields ON dm_messages;
CREATE TRIGGER trg_lock_dm_message_fields
  BEFORE UPDATE ON dm_messages
  FOR EACH ROW EXECUTE FUNCTION lock_dm_message_fields();

-- ============================================================================
-- Done. To verify afterward, this should return zero rows in both cases:
--
--   -- No existing row already violates the new profile-binding rule:
--   select id from marketplace_posts mp
--    where not exists (
--      select 1 from profiles p
--       where p.id = mp.poster_profile_id and p.user_id = mp.poster_user_id
--    );
--
--   select id from connection_requests cr
--    where not exists (
--      select 1 from profiles p
--       where p.id = cr.requester_profile_id and p.user_id = cr.requester_user_id
--    );
-- ============================================================================

-- ============================================================================
-- SplitMic Step 5: Connections & Messaging
-- ============================================================================
-- Run this in Supabase SQL Editor. Safe to re-run.
--
-- What this creates:
--   1. message_threads        — one row per 2-party conversation
--   2. messages               — individual messages in a thread
--   3. Trigger: when a connection_request is accepted, auto-create the thread
--      (and insert the request's message as the first message)
--   4. RLS policies + indexes
-- ============================================================================

-- ── 1. message_threads ──────────────────────────────────────────────────────
-- Pair of profiles in a conversation. Ordered so the smaller UUID is profile_a
-- — this prevents duplicate threads (a↔b and b↔a).
CREATE TABLE IF NOT EXISTS message_threads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_a_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  profile_b_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_a_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ordered_pair CHECK (profile_a_id < profile_b_id),
  UNIQUE (profile_a_id, profile_b_id)
);

CREATE INDEX IF NOT EXISTS idx_threads_profile_a
  ON message_threads (profile_a_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_profile_b
  ON message_threads (profile_b_id, last_message_at DESC);

-- ── 2. messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id         UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body              TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_created
  ON messages (thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages (thread_id, sender_user_id, read_at);

-- ── 3. Trigger: bump thread's last_message_at on new message ───────────────
CREATE OR REPLACE FUNCTION bump_thread_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE message_threads
     SET last_message_at = NEW.created_at
   WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bump_thread_last_message ON messages;
CREATE TRIGGER trg_bump_thread_last_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION bump_thread_last_message();

-- ── 4. Trigger: when a connection_request is accepted, create thread + seed
--     the initial message (if any). Also sets responded_at.
CREATE OR REPLACE FUNCTION on_connection_request_accept()
RETURNS TRIGGER AS $$
DECLARE
  smaller_pid UUID;
  larger_pid  UUID;
  smaller_uid UUID;
  larger_uid  UUID;
  thread_id_var UUID;
BEGIN
  -- Stamp responded_at on any status change away from pending
  IF NEW.status <> 'pending' AND OLD.status = 'pending' THEN
    NEW.responded_at := NOW();
  END IF;

  -- Only create thread on accept
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

    -- Insert thread if it doesn't exist
    INSERT INTO message_threads
      (profile_a_id, profile_b_id, user_a_id, user_b_id)
    VALUES (smaller_pid, larger_pid, smaller_uid, larger_uid)
    ON CONFLICT (profile_a_id, profile_b_id) DO NOTHING
    RETURNING id INTO thread_id_var;

    -- If conflict, fetch the existing thread id
    IF thread_id_var IS NULL THEN
      SELECT id INTO thread_id_var
        FROM message_threads
       WHERE profile_a_id = smaller_pid AND profile_b_id = larger_pid;
    END IF;

    -- Seed first message from the request's body (if any)
    IF NEW.message IS NOT NULL AND char_length(NEW.message) > 0 THEN
      INSERT INTO messages (thread_id, sender_profile_id, sender_user_id, body)
      VALUES (thread_id_var, NEW.requester_profile_id, NEW.requester_user_id, NEW.message);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_connection_request_accept ON connection_requests;
CREATE TRIGGER trg_connection_request_accept
  BEFORE UPDATE ON connection_requests
  FOR EACH ROW EXECUTE FUNCTION on_connection_request_accept();

-- ── 5. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages         ENABLE ROW LEVEL SECURITY;

-- message_threads: only the two parties can read/insert
DROP POLICY IF EXISTS "mt_party_read" ON message_threads;
CREATE POLICY "mt_party_read" ON message_threads
  FOR SELECT TO authenticated
  USING (user_a_id = auth.uid() OR user_b_id = auth.uid());

DROP POLICY IF EXISTS "mt_party_insert" ON message_threads;
CREATE POLICY "mt_party_insert" ON message_threads
  FOR INSERT TO authenticated
  WITH CHECK (user_a_id = auth.uid() OR user_b_id = auth.uid());

DROP POLICY IF EXISTS "mt_party_update" ON message_threads;
CREATE POLICY "mt_party_update" ON message_threads
  FOR UPDATE TO authenticated
  USING (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- messages: parties can read all in their threads; sender inserts own messages
DROP POLICY IF EXISTS "msg_party_read" ON messages;
CREATE POLICY "msg_party_read" ON messages
  FOR SELECT TO authenticated
  USING (
    thread_id IN (
      SELECT id FROM message_threads
       WHERE user_a_id = auth.uid() OR user_b_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "msg_sender_insert" ON messages;
CREATE POLICY "msg_sender_insert" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND thread_id IN (
      SELECT id FROM message_threads
       WHERE user_a_id = auth.uid() OR user_b_id = auth.uid()
    )
  );

-- Allow recipients to mark messages as read (only their received messages)
DROP POLICY IF EXISTS "msg_recipient_mark_read" ON messages;
CREATE POLICY "msg_recipient_mark_read" ON messages
  FOR UPDATE TO authenticated
  USING (
    sender_user_id <> auth.uid()
    AND thread_id IN (
      SELECT id FROM message_threads
       WHERE user_a_id = auth.uid() OR user_b_id = auth.uid()
    )
  );

-- ============================================================================
-- Done.
-- ============================================================================

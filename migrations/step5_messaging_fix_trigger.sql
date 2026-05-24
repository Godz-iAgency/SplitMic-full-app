-- ============================================================================
-- SplitMic Step 5 FIX: trigger needs SECURITY DEFINER + correct table name
-- ============================================================================
-- Problem: when the recipient accepts a connection_request, the trigger tries
-- to insert the requester's first message into dm_messages. But RLS blocks it
-- because auth.uid() is the recipient, not the message's sender.
--
-- Fix: rebuild the trigger function with SECURITY DEFINER so it runs as the
-- table owner and bypasses RLS for this one system-controlled insert.
-- Also corrects the table name from "messages" to "dm_messages".
--
-- Safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION on_connection_request_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    -- If conflict (thread already existed), fetch its id
    IF thread_id_var IS NULL THEN
      SELECT id INTO thread_id_var
        FROM message_threads
       WHERE profile_a_id = smaller_pid AND profile_b_id = larger_pid;
    END IF;

    -- Seed the requester's first message (if any) — correct table name
    IF NEW.message IS NOT NULL AND char_length(NEW.message) > 0 THEN
      INSERT INTO dm_messages (thread_id, sender_profile_id, sender_user_id, body)
      VALUES (thread_id_var, NEW.requester_profile_id, NEW.requester_user_id, NEW.message);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-bind the trigger (drop + create so it points at the new function body)
DROP TRIGGER IF EXISTS trg_connection_request_accept ON connection_requests;
CREATE TRIGGER trg_connection_request_accept
  BEFORE UPDATE ON connection_requests
  FOR EACH ROW EXECUTE FUNCTION on_connection_request_accept();

-- ============================================================================
-- Done.
-- ============================================================================

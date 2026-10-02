-- ============================================================================
-- SplitMic Step 25: Fix deleting a post that has requests pointing at it
-- ============================================================================
-- Run this in Supabase SQL Editor. Safe to re-run. Changes no data.
--
-- The bug: connection_requests.related_post_id is ON DELETE SET NULL, so when a
-- post is deleted Postgres UPDATEs every request that pointed at it to clear
-- the link. step20's lock_connection_request_fields() trigger refuses any
-- change to related_post_id ("only status may be changed on an existing
-- connection request"), so that internal UPDATE failed and took the whole
-- DELETE down with it. Net effect since step20:
--
--   - an owner couldn't delete a post that had received any response, and
--   - the weekly cleanup job would fail its whole batch on the first expired
--     post that had a request attached.
--
-- Found while testing Gear & services, whose Contact requests also carry the
-- show's id (PROGRESS.md §2 #28), which would have made more posts undeletable.
-- Nothing tested "delete a post that has a request" before; step20's own
-- verification covered the attack paths, not this one.
--
-- The fix: related_post_id may now be cleared (set to NULL), never changed to
-- anything else. Every other column stays locked exactly as before, and the
-- one-response-only rule is untouched. Clearing a pointer to a post is what the
-- foreign key does anyway, and a request can't be re-pointed at another post.
-- ============================================================================

CREATE OR REPLACE FUNCTION lock_connection_request_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.requester_profile_id <> OLD.requester_profile_id
     OR NEW.requester_user_id <> OLD.requester_user_id
     OR NEW.recipient_profile_id <> OLD.recipient_profile_id
     OR NEW.recipient_user_id <> OLD.recipient_user_id
     OR NEW.request_type <> OLD.request_type
     OR NEW.message IS DISTINCT FROM OLD.message
     -- Clearing the link is allowed (a deleted post); re-pointing it is not.
     OR (NEW.related_post_id IS DISTINCT FROM OLD.related_post_id
         AND NEW.related_post_id IS NOT NULL) THEN
    RAISE EXCEPTION 'only status may be changed on an existing connection request';
  END IF;
  IF NEW.status <> OLD.status AND OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'a connection request can only be responded to once';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Done. The trigger itself (trg_lock_connection_request_fields) is unchanged;
-- only its function body was replaced.
-- ============================================================================

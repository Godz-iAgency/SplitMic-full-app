-- ============================================================================
-- SplitMic Step 22: Enforce suspension at the database, not just in app code
-- ============================================================================
-- Run this in Supabase SQL Editor. Safe to re-run.
--
-- app/opportunities/actions.ts, app/inbox/actions.ts, and app/admin/actions.ts
-- were updated to block a suspended account from posting, sending a
-- connection request, accepting one, or sending a message, and to close
-- their active marketplace posts on suspend. That's real, but it's only
-- app-level trust — exactly the class of gap step20/step21 closed for
-- everything else today. This makes the same rules hold at the database
-- layer, so a suspended account can't get around them with a direct API
-- call the way profile-id spoofing and the thread-open bypass could before.
--
-- What still works while suspended (deliberately untouched): reading your
-- own data, declining an incoming connection request, marking a message
-- read. Only new posts / new requests / accepting a request / new messages
-- / new threads are blocked.
-- ============================================================================

-- ── marketplace_posts: suspended accounts can't post ────────────────────────
DROP POLICY IF EXISTS "mp_posts_owner_insert" ON marketplace_posts;
CREATE POLICY "mp_posts_owner_insert" ON marketplace_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    poster_user_id = auth.uid()
    AND poster_profile_id IN (
      SELECT id FROM profiles
       WHERE user_id = auth.uid() AND player_type <> 'band' AND is_suspended = FALSE
    )
  );

-- ── connection_requests: suspended accounts can't send one, and can't
--    accept an incoming one (declining is still allowed) ───────────────────
DROP POLICY IF EXISTS "cr_requester_insert" ON connection_requests;
CREATE POLICY "cr_requester_insert" ON connection_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_user_id = auth.uid()
    AND requester_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND is_suspended = FALSE
    )
  );

DROP POLICY IF EXISTS "cr_recipient_update" ON connection_requests;
CREATE POLICY "cr_recipient_update" ON connection_requests
  FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid())
  WITH CHECK (
    status <> 'accepted'
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.is_suspended = FALSE
    )
  );

-- ── message_threads: suspended accounts can't open a new thread, by either
--    path (direct industry DM or an accepted connection) ───────────────────
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
         WHERE p.user_id = auth.uid() AND p.player_type <> 'band'
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

-- ── dm_messages: suspended accounts can't send a new message (marking a
--    received message read is untouched) ────────────────────────────────────
DROP POLICY IF EXISTS "dm_sender_insert" ON dm_messages;
CREATE POLICY "dm_sender_insert" ON dm_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND thread_id IN (
      SELECT id FROM message_threads
       WHERE user_a_id = auth.uid() OR user_b_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.is_suspended = FALSE
    )
  );

-- ============================================================================
-- Done.
-- ============================================================================

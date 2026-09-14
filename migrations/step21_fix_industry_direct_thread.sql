-- ============================================================================
-- SplitMic Step 21: Fix industry-to-industry direct messaging (regression)
-- ============================================================================
-- Run this in Supabase SQL Editor. Safe to re-run. Fixes a bug step20
-- introduced — apply this immediately after/instead of a bare step20.
--
-- step20's "mt_party_insert" required an accepted connection_requests row
-- before ANY message thread could be created. That was too strict: per
-- app/inbox/actions.ts's own initiateConnection(), an industry player
-- (venue/talent_buyer/record_label/festival) can message anyone directly,
-- with no connection request at all — that's a deliberate product feature,
-- not a hole. Only a BAND initiating is meant to require an accepted
-- connection first. Confirmed live: after step20, a real industry-to-industry
-- direct thread insert (the app's own normal path) was rejected with
-- "new row violates row-level security policy for table message_threads".
--
-- This replaces the policy so it matches the app's actual rule: an industry
-- caller may open a thread with anyone; a band caller still needs an
-- accepted connection between the two profiles first.
-- ============================================================================

DROP POLICY IF EXISTS "mt_party_insert" ON message_threads;
CREATE POLICY "mt_party_insert" ON message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_a_id = auth.uid() OR user_b_id = auth.uid())
    AND (
      -- Caller is an industry-type profile: direct DM, matches
      -- initiateConnection()'s "industry -> anyone = direct thread" rule.
      EXISTS (
        SELECT 1 FROM profiles p
         WHERE p.user_id = auth.uid() AND p.player_type <> 'band'
      )
      -- Caller is a band: only after an accepted connection request.
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

-- ============================================================================
-- Done.
-- ============================================================================

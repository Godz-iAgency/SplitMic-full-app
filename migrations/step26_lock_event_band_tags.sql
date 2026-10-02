-- ============================================================================
-- SplitMic Step 26: Lock down event band tags
-- ============================================================================
-- Run this in Supabase SQL Editor. Safe to re-run. Changes no data.
-- Not blocking: the app works without it, but until it runs the holes below
-- are open. Run it before or after deploying; the order doesn't matter.
--
-- event_band_tags (step4) is how a venue lists a band on a show: the venue
-- tags the band, and the band accepts before it appears in the public lineup.
-- That consent is the whole point of the table, and step4's policies didn't
-- enforce it. Found while adding the "you've been tagged" notification, by
-- trying each of these as the wrong user (all four worked):
--
--   1. A venue could INSERT a tag already marked 'accepted', putting a band in
--      its public lineup without the band ever agreeing.
--   2. A band could UPDATE any column of its own tag, including
--      marketplace_post_id: re-point it at any other venue's show, mark itself
--      accepted, and appear in that show's lineup uninvited.
--   3. A band could flip declined back to accepted (and back), so "answered"
--      meant nothing.
--   4. A venue could tag any profile, not only bands.
--
-- The fix is the same shape as step24 (show_vendors) and step20:
--   - INSERT: the post's owner only, on their own ACTIVE event post, as
--     'pending' with no response, naming a published, unsuspended BAND, and
--     never while the owner is suspended.
--   - UPDATE: the tagged band only (policy), and a trigger lets exactly two
--     things change: status, once, pending -> accepted/declined (the trigger
--     stamps responded_at itself), and shared_to_feed, only while accepted.
-- RLS can't compare old and new values, which is why the lock is a trigger.
--
-- Nothing the app does today is affected: it inserts tags as pending at post
-- creation, the band answers once, and an accepted band toggles sharing.
-- ============================================================================

DROP POLICY IF EXISTS "ebt_poster_insert" ON event_band_tags;
CREATE POLICY "ebt_poster_insert" ON event_band_tags
  FOR INSERT TO authenticated
  WITH CHECK (
    tagged_by_user_id = auth.uid()
    AND status = 'pending'
    AND shared_to_feed = FALSE
    AND responded_at IS NULL
    AND marketplace_post_id IN (
      SELECT id FROM marketplace_posts
       WHERE poster_user_id = auth.uid()
         AND is_active = TRUE
         AND post_type = 'event'
    )
    AND band_profile_id IN (
      SELECT id FROM profiles
       WHERE is_published = TRUE
         AND is_suspended = FALSE
         AND player_type = 'band'
    )
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.is_suspended = FALSE
    )
  );

DROP POLICY IF EXISTS "ebt_band_update" ON event_band_tags;
CREATE POLICY "ebt_band_update" ON event_band_tags
  FOR UPDATE TO authenticated
  USING (band_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (
    band_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND (
      status <> 'accepted'
      OR EXISTS (
        SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.is_suspended = FALSE
      )
    )
  );

CREATE OR REPLACE FUNCTION lock_event_band_tag_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.marketplace_post_id <> OLD.marketplace_post_id
     OR NEW.band_profile_id <> OLD.band_profile_id
     OR NEW.tagged_by_user_id <> OLD.tagged_by_user_id
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'only the response may be changed on an event band tag';
  END IF;
  IF NEW.status <> OLD.status AND OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'an event band tag can only be answered once';
  END IF;
  IF NEW.status <> OLD.status THEN
    NEW.responded_at := NOW();
  ELSE
    NEW.responded_at := OLD.responded_at;
  END IF;
  IF NEW.shared_to_feed AND NEW.status <> 'accepted' THEN
    RAISE EXCEPTION 'accept the tag before sharing it';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_event_band_tag_fields ON event_band_tags;
CREATE TRIGGER trg_lock_event_band_tag_fields
  BEFORE UPDATE ON event_band_tags
  FOR EACH ROW EXECUTE FUNCTION lock_event_band_tag_fields();

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Done. To verify afterward:
--
--   -- Four policies (expect ebt_band_read, ebt_band_update, ebt_poster_delete,
--   -- ebt_poster_insert):
--   select policyname from pg_policies where tablename = 'event_band_tags'
--    order by policyname;
--
--   -- Look for tags forged before this fix. Legit tags are accepted only via
--   -- the band's own response, which always stamps responded_at, and are
--   -- created by the post's owner. Expect no rows; any row is worth a look
--   -- (remove it with a normal DELETE if the band never agreed to it):
--   select t.id, t.status, t.responded_at, t.marketplace_post_id, t.band_profile_id
--     from event_band_tags t
--     join marketplace_posts p on p.id = t.marketplace_post_id
--    where (t.status <> 'pending' and t.responded_at is null)
--       or t.tagged_by_user_id <> p.poster_user_id;
-- ============================================================================

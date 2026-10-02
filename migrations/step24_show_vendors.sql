-- ============================================================================
-- SplitMic Step 24: Gear & services on shows
-- ============================================================================
-- Run this in Supabase SQL Editor BEFORE deploying the code that ships with it
-- (the show page reads this table). Safe to re-run.
--
-- A venue or festival can list backline, instrument-rental, and rehearsal
-- businesses on a show or open mic post (PROGRESS.md §2 #28). The business has
-- to accept before it appears publicly, the same way a band accepts an event
-- tag: a venue must not be able to advertise "backline by X" unless X agreed.
--
-- What this creates:
--   show_vendors — one row per business per show, pending → accepted/declined.
--
-- Who can do what (enforced here, not just in the app):
--   - Read:   anyone signed in sees ACCEPTED rows. Pending and declined rows
--             are visible only to the business itself and the post's owner.
--   - Insert: only the post's owner, only on their own ACTIVE show or open mic
--             (never an opportunity post), only as 'pending', only naming a
--             published, unsuspended backline/rental/rehearsal profile, and
--             never while the owner is suspended.
--   - Update: only the business, only its status, only once (pending →
--             accepted/declined), and it can't accept while suspended.
--   - Delete: the post's owner (take it off the show) or the business
--             (remove itself).
-- ============================================================================

CREATE TABLE IF NOT EXISTS show_vendors (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_post_id  UUID NOT NULL REFERENCES marketplace_posts(id) ON DELETE CASCADE,
  vendor_profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  added_by_user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at         TIMESTAMPTZ,
  -- One listing per business per show. A declined row stays until the owner
  -- removes it, so re-asking is a deliberate remove-then-add, not a repeat tap.
  UNIQUE (marketplace_post_id, vendor_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_show_vendors_post
  ON show_vendors (marketplace_post_id);
CREATE INDEX IF NOT EXISTS idx_show_vendors_vendor
  ON show_vendors (vendor_profile_id, status);

-- Signed-in only, like the show pages themselves. Nothing here is meant for
-- the logged-out public.
REVOKE ALL ON show_vendors FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON show_vendors TO authenticated;

ALTER TABLE show_vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sv_read" ON show_vendors;
CREATE POLICY "sv_read" ON show_vendors
  FOR SELECT TO authenticated
  USING (
    status = 'accepted'
    OR vendor_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR marketplace_post_id IN (
      SELECT id FROM marketplace_posts WHERE poster_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "sv_poster_insert" ON show_vendors;
CREATE POLICY "sv_poster_insert" ON show_vendors
  FOR INSERT TO authenticated
  WITH CHECK (
    added_by_user_id = auth.uid()
    AND status = 'pending'
    AND responded_at IS NULL
    AND marketplace_post_id IN (
      SELECT id FROM marketplace_posts
       WHERE poster_user_id = auth.uid()
         AND is_active = TRUE
         AND post_type IN ('event', 'open_mic')
    )
    AND vendor_profile_id IN (
      SELECT id FROM profiles
       WHERE is_published = TRUE
         AND is_suspended = FALSE
         AND player_type IN ('backline', 'instrument_rental', 'rehearsal_studio')
    )
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.is_suspended = FALSE
    )
  );

DROP POLICY IF EXISTS "sv_vendor_update" ON show_vendors;
CREATE POLICY "sv_vendor_update" ON show_vendors
  FOR UPDATE TO authenticated
  USING (vendor_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (
    vendor_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND status IN ('accepted', 'declined')
    AND (
      status <> 'accepted'
      OR EXISTS (
        SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.is_suspended = FALSE
      )
    )
  );

DROP POLICY IF EXISTS "sv_party_delete" ON show_vendors;
CREATE POLICY "sv_party_delete" ON show_vendors
  FOR DELETE TO authenticated
  USING (
    vendor_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR marketplace_post_id IN (
      SELECT id FROM marketplace_posts WHERE poster_user_id = auth.uid()
    )
  );

-- RLS can't compare old and new values, so the "status only, answered once"
-- rule lives in a trigger, the same pattern step20 uses for connection
-- requests. It also stamps responded_at itself, so the client never sets it.
CREATE OR REPLACE FUNCTION lock_show_vendor_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.marketplace_post_id <> OLD.marketplace_post_id
     OR NEW.vendor_profile_id <> OLD.vendor_profile_id
     OR NEW.added_by_user_id <> OLD.added_by_user_id
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'only status may be changed on a show vendor listing';
  END IF;
  IF NEW.status <> OLD.status AND OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'a show vendor listing can only be answered once';
  END IF;
  IF NEW.status <> OLD.status THEN
    NEW.responded_at := NOW();
  ELSE
    NEW.responded_at := OLD.responded_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_show_vendor_fields ON show_vendors;
CREATE TRIGGER trg_lock_show_vendor_fields
  BEFORE UPDATE ON show_vendors
  FOR EACH ROW EXECUTE FUNCTION lock_show_vendor_fields();

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Done. To verify afterward:
--
--   -- RLS is on (expect true):
--   select relrowsecurity from pg_class where relname = 'show_vendors';
--
--   -- Four policies (expect sv_party_delete, sv_poster_insert, sv_read,
--   -- sv_vendor_update):
--   select policyname from pg_policies where tablename = 'show_vendors'
--    order by policyname;
-- ============================================================================

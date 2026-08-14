-- ============================================================================
-- SplitMic Step 16: Intro video as a link, not an upload
-- ============================================================================
-- Run this in the Supabase SQL editor.
-- Safe to re-run (uses IF NOT EXISTS guards).
--
-- What this adds:
--   `profiles.intro_video_url` — a link to a video the user already hosts
--   (YouTube, Vimeo, Loom, SoundCloud, Spotify, Google Drive), embedded in an
--   iframe on the profile page. See lib/media/videoEmbed.ts for the resolver
--   and the reasoning behind the provider allowlist.
--
-- Replaces the old flow, where a 30-second clip was uploaded into the
-- `profile-media` bucket as a row with kind = 'video'. That capped every
-- intro at 30s/50MB, cost storage on every profile, and re-encoded nothing —
-- while most users already have their music video hosted somewhere better.
--
-- Deliberately NOT dropping anything:
--   * `profile_media` rows with kind = 'video' are left in place. They stop
--     being read by the app after this deploy, but deleting a user's uploaded
--     video is irreversible and buys nothing — same treatment as the unused
--     step13 Places columns. Clean them up later, deliberately, if ever.
--   * The `kind` CHECK constraint still permits 'video' so those old rows stay
--     valid and any straggler write doesn't error.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS intro_video_url TEXT;

-- ============================================================================
-- Done. Verify:
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'profiles' AND column_name = 'intro_video_url';
--   -- expect 1 row
--
--   -- How many profiles still have an old uploaded video that will stop
--   -- showing until they paste a link (informational, not a problem):
--   SELECT count(*) FROM profile_media WHERE kind = 'video';
-- ============================================================================

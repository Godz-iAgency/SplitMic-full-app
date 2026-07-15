-- ============================================================================
-- SplitMic Step 9: Clean up placeholder Spotify links
-- ============================================================================
-- Run this once in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- An earlier build of the band onboarding form pre-filled a hardcoded
-- placeholder Spotify artist URL as the default value. Any band that
-- completed onboarding without editing that field had the placeholder saved
-- as their real Spotify link (in profile_links). The default has since been
-- removed from the form; this deletes the polluted rows already in the DB.
--
-- The match is on the exact placeholder URL only, so a band that genuinely
-- pasted a different Spotify link is untouched. In the vanishingly unlikely
-- case a real band IS that specific artist, they can re-add their link.
-- ============================================================================

DELETE FROM profile_links
WHERE platform = 'spotify'
  AND url = 'https://open.spotify.com/artist/4Z8W4fKeB0KNGotKc4MLB5';

-- ============================================================================
-- Verify how many were removed (optional): re-run the SELECT below — it should
-- return 0 rows after the DELETE.
--
--   SELECT profile_id, url FROM profile_links
--    WHERE platform = 'spotify'
--      AND url = 'https://open.spotify.com/artist/4Z8W4fKeB0KNGotKc4MLB5';
-- ============================================================================

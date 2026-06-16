-- ─────────────────────────────────────────────────────────────────────────────
-- Step 7 — Band Readiness Score
-- Adds the self-reported reach/draw fields that feed the Band Readiness Score.
-- The score itself is computed in app code (lib/scoring/bandReadiness.ts) — these
-- columns are just the raw inputs. All nullable so existing bands aren't broken.
--
-- Run this in the Supabase SQL editor (project: riberoeharuziezdlcev).
-- Safe to run more than once (IF NOT EXISTS guards).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.band_details
  ADD COLUMN IF NOT EXISTS email_list_size integer,
  ADD COLUMN IF NOT EXISTS typical_draw text,
  ADD COLUMN IF NOT EXISTS largest_venue_capacity text,
  ADD COLUMN IF NOT EXISTS tiktok_followers integer,
  ADD COLUMN IF NOT EXISTS youtube_followers integer;

-- Guard the bucket columns to the exact values the app writes, so bad data can't
-- silently break scoring. NULL is always allowed (band hasn't filled it in yet).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'band_details_typical_draw_check'
  ) THEN
    ALTER TABLE public.band_details
      ADD CONSTRAINT band_details_typical_draw_check
      CHECK (typical_draw IS NULL OR typical_draw IN ('0-25', '25-75', '75-200', '200+'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'band_details_largest_venue_capacity_check'
  ) THEN
    ALTER TABLE public.band_details
      ADD CONSTRAINT band_details_largest_venue_capacity_check
      CHECK (largest_venue_capacity IS NULL OR largest_venue_capacity IN ('under-100', '100-300', '300-1000', '1000-plus'));
  END IF;
END $$;

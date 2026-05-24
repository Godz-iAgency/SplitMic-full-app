-- ============================================================================
-- SplitMic Step 1: Onboarding Field Additions
-- ============================================================================
-- Run this in the Supabase SQL editor.
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards).
--
-- What this does:
--   1. Adds phone_number + website_url to profiles (common contact fields)
--   2. Migrates existing band_details.phone_number → profiles.phone_number
--   3. Drops band_details.phone_number (now lives on profiles)
--   4. Adds booking_email + booking fee range to band_details
--   5. Adds venue_type, age_restriction, pay structure to venue_details
--   6. Adds contact_email, artist budget range, events/year to talent_buyer_details
--   7. Adds submission_email, deal_types, looking_for to record_label_details
--   8. Adds festival_season, pay info, application_email, festival_type to festival_details
-- ============================================================================

-- 1. Common contact fields on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone_number  TEXT,
  ADD COLUMN IF NOT EXISTS website_url   TEXT;

-- 2. Migrate band phone numbers from band_details → profiles (one-time)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'band_details'
      AND column_name = 'phone_number'
  ) THEN
    UPDATE profiles p
       SET phone_number = bd.phone_number
      FROM band_details bd
     WHERE p.id = bd.profile_id
       AND p.phone_number IS NULL
       AND bd.phone_number IS NOT NULL;
  END IF;
END $$;

-- 3. Drop band_details.phone_number (data is now on profiles)
ALTER TABLE band_details DROP COLUMN IF EXISTS phone_number;

-- 4. Bands: booking email + booking fee range
ALTER TABLE band_details
  ADD COLUMN IF NOT EXISTS booking_email     TEXT,
  ADD COLUMN IF NOT EXISTS booking_fee_min   INTEGER,
  ADD COLUMN IF NOT EXISTS booking_fee_max   INTEGER;

-- 5. Venues: venue_type, age_restriction, pay structure for bands
ALTER TABLE venue_details
  ADD COLUMN IF NOT EXISTS venue_type       TEXT,
  ADD COLUMN IF NOT EXISTS age_restriction  TEXT,
  ADD COLUMN IF NOT EXISTS pay_structure    TEXT,
  ADD COLUMN IF NOT EXISTS pay_min          INTEGER,
  ADD COLUMN IF NOT EXISTS pay_max          INTEGER;

-- 6. Talent Buyers: contact email, artist budget range, events / year
ALTER TABLE talent_buyer_details
  ADD COLUMN IF NOT EXISTS contact_email        TEXT,
  ADD COLUMN IF NOT EXISTS artist_budget_min    INTEGER,
  ADD COLUMN IF NOT EXISTS artist_budget_max    INTEGER,
  ADD COLUMN IF NOT EXISTS events_per_year      INTEGER;

-- 7. Record Labels: submission email, deal types (array), A&R brief
ALTER TABLE record_label_details
  ADD COLUMN IF NOT EXISTS submission_email   TEXT,
  ADD COLUMN IF NOT EXISTS deal_types         TEXT[],
  ADD COLUMN IF NOT EXISTS looking_for        TEXT;

-- 8. Festivals: season, payment, application contact, festival type
ALTER TABLE festival_details
  ADD COLUMN IF NOT EXISTS festival_season     TEXT,
  ADD COLUMN IF NOT EXISTS pays_bands          BOOLEAN,
  ADD COLUMN IF NOT EXISTS pay_min             INTEGER,
  ADD COLUMN IF NOT EXISTS pay_max             INTEGER,
  ADD COLUMN IF NOT EXISTS application_email   TEXT,
  ADD COLUMN IF NOT EXISTS festival_type       TEXT;

-- ============================================================================
-- Done. profile_links table needs no changes — facebook + twitter / x + website
-- can be stored there too if desired, but for clarity we keep website + phone
-- on profiles, social platforms (facebook, twitter, spotify, youtube, tiktok)
-- in profile_links.
-- ============================================================================

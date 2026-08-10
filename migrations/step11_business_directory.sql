-- ============================================================================
-- SplitMic Step 11: Business Directory
-- ============================================================================
-- Run this in the Supabase SQL editor.
-- Safe to re-run (uses IF NOT EXISTS / DROP ... IF EXISTS guards).
--
-- What this creates:
--   directory_businesses — a curated directory of Austin music businesses
--   across 8 categories, imported from a scraped CSV (see lib/directory/).
--   Publicly readable on /directory, written only by the service-role client
--   from the admin import (app/admin/directory).
--
-- These are NOT SplitMic accounts. `profiles` holds real signed-up players;
-- this table holds mostly-unclaimed leads, any of which may later be linked
-- to a real profile via claimed_profile_id.
--
-- SECURITY NOTE: this table holds scraped third-party contact emails and the
-- owner's private outreach pipeline. RLS alone does NOT protect those — RLS
-- is row-level, and the public anon key can query PostgREST directly for any
-- column of any readable row. The column GRANTs at the bottom of this file
-- are what actually keep email/outreach data server-side. Do not remove them.
-- ============================================================================

CREATE TABLE IF NOT EXISTS directory_businesses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  category              TEXT NOT NULL
                          CHECK (category IN (
                            'venue', 'record_label', 'talent_buyer', 'festival',
                            'band', 'instrument_rental', 'rehearsal_studio', 'backline'
                          )),
  business_name         TEXT NOT NULL CHECK (btrim(business_name) <> ''),
  -- Lowercased, punctuation-collapsed form of business_name. Written by the
  -- importer (lib/directory/mapRow.ts normalizeBusinessName), not generated —
  -- the [a-z] range in a regexp is collation-dependent, and several business
  -- names are non-ASCII ("Superfónicos").
  name_key              TEXT NOT NULL CHECK (name_key = btrim(name_key) AND name_key <> ''),

  -- Outreach only. Never rendered publicly, never granted to anon (see below).
  email                 TEXT,
  website_url           TEXT,
  phone                 TEXT,
  description           TEXT,
  -- Per-category refinement: venue type, band genre, festival season.
  subcategory           TEXT,

  city                  TEXT NOT NULL DEFAULT 'Austin',
  region                TEXT NOT NULL DEFAULT 'TX',

  tier                  TEXT NOT NULL DEFAULT 'standard'
                          CHECK (tier IN ('standard', 'featured', 'spotlight')),
  -- PostgREST can't express ORDER BY CASE, so the sort key is materialized.
  -- Generated columns are read-only: never include tier_rank in a write payload.
  tier_rank             SMALLINT GENERATED ALWAYS AS (
                          CASE tier
                            WHEN 'spotlight' THEN 0
                            WHEN 'featured'  THEN 1
                            ELSE 2
                          END
                        ) STORED,
  -- Manual tie-break within a tier. Higher sorts first.
  sort_weight           INTEGER NOT NULL DEFAULT 0,

  -- Set when this business signs up for a real SplitMic account. There is
  -- deliberately no is_claimed boolean — claimed means this is not null, and
  -- a derived value can't drift out of sync the way a denormalized one can.
  claimed_profile_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  claimed_at            TIMESTAMPTZ,

  outreach_status       TEXT NOT NULL DEFAULT 'not_contacted'
                          CHECK (outreach_status IN (
                            'not_contacted', 'contacted', 'responded',
                            'signed_up', 'do_not_contact'
                          )),
  outreach_notes        TEXT,
  last_contacted_at     TIMESTAMPTZ,

  source                TEXT NOT NULL DEFAULT 'firecrawl_csv',
  -- Verbatim CSV row, so a future re-parse never needs the original file.
  source_row            JSONB,

  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  last_imported_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- The pair, not the name alone: ~10 businesses legitimately appear in more
  -- than one category (SoundCheck Austin is backline AND instrument rental AND
  -- a rehearsal studio). Keying on name would silently drop those rows.
  -- This is also what makes re-importing idempotent.
  CONSTRAINT directory_businesses_category_name_key UNIQUE (category, name_key)
);

-- Exact shape of the public per-category query.
CREATE INDEX IF NOT EXISTS idx_directory_active_browse
  ON directory_businesses (category, tier_rank, sort_weight DESC, business_name)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_directory_name_search
  ON directory_businesses (lower(business_name));

CREATE INDEX IF NOT EXISTS idx_directory_claimed
  ON directory_businesses (claimed_profile_id)
  WHERE claimed_profile_id IS NOT NULL;

-- The admin outreach queue.
CREATE INDEX IF NOT EXISTS idx_directory_outreach
  ON directory_businesses (outreach_status, category);

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE directory_businesses ENABLE ROW LEVEL SECURITY;

-- Public, unauthenticated read of active rows — /directory is a guest-facing
-- page. No INSERT/UPDATE/DELETE policy for anon or authenticated at all:
-- every write goes through the service-role client, which bypasses RLS.
DROP POLICY IF EXISTS "directory_public_read" ON directory_businesses;
CREATE POLICY "directory_public_read" ON directory_businesses
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

-- ── Column privileges ────────────────────────────────────────────────────
-- The piece RLS cannot do. Without this, anyone with the public anon key can
-- request ?select=email and harvest every scraped contact address, or read
-- the private outreach pipeline. Revoke the blanket grant, then re-grant only
-- the columns the public directory page actually renders.
--
-- Service role bypasses column privileges, so the admin UI and the CSV import
-- are unaffected.
REVOKE SELECT ON directory_businesses FROM anon, authenticated;
GRANT SELECT (
  id,
  category,
  business_name,
  website_url,
  phone,
  description,
  subcategory,
  city,
  region,
  tier,
  tier_rank,
  claimed_profile_id,
  is_active,
  created_at,
  updated_at
) ON directory_businesses TO anon, authenticated;

-- Deliberately NOT granted: email, name_key, outreach_status, outreach_notes,
-- last_contacted_at, claimed_at, source, source_row, sort_weight,
-- last_imported_at.

-- ============================================================================
-- Done. Test:
--
--   -- As service role (the SQL editor bypasses RLS), insert a row:
--   INSERT INTO directory_businesses (category, business_name, name_key,
--     email, website_url, description, subcategory)
--   VALUES ('venue', 'Mohawk Austin', 'mohawk austin',
--     'booking@example.com', 'https://mohawkaustin.com',
--     NULL, 'Clubs & Small Venues');
--
--   -- Confirm the public column grants: this should SUCCEED for anon,
--   SELECT id, business_name, website_url FROM directory_businesses;
--
--   -- ...and this should FAIL for anon with "permission denied for column email":
--   SELECT email FROM directory_businesses;
--
--   -- Re-import safety: the unique constraint makes a repeat insert a no-op
--   -- conflict rather than a duplicate row.
-- ============================================================================

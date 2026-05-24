-- ============================================================================
-- SplitMic Step 6: Admin Dashboard
-- ============================================================================
-- Adds:
--   1. profiles.is_suspended + suspended_at + suspended_reason
--   2. admin_action_log table (audit trail of every admin action)
--   3. Index on suspended profiles
--   4. RLS so the action log is admin-readable only
--
-- Safe to re-run.
-- ============================================================================

-- ── 1. Suspension fields on profiles ──────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_suspended      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason  TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_suspended
  ON profiles (is_suspended) WHERE is_suspended = true;

-- ── 2. Admin action log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_action_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  admin_email   TEXT,
  action_type   TEXT NOT NULL,
  target_type   TEXT NOT NULL,
  target_id     UUID,
  target_label  TEXT,
  details       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_log_created
  ON admin_action_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_log_target
  ON admin_action_log (target_type, target_id);

-- ── 3. RLS on admin_action_log ────────────────────────────────────────────
-- We don't expose admin_action_log to normal users at all. Service layer reads
-- it via the server-side anon key after verifying the user is an admin by
-- their email. So we keep RLS enabled with no SELECT policy — only an admin
-- check in server code can read it (we'll use service-style server reads).
ALTER TABLE admin_action_log ENABLE ROW LEVEL SECURITY;

-- ── 4. Suspended users should be hidden from non-admin reads ───────────────
-- We won't enforce this in RLS (too disruptive); we filter is_suspended in the
-- discovery/marketplace queries instead.
-- ============================================================================
-- Done.
-- ============================================================================

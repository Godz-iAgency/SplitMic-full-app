-- ============================================================================
-- SplitMic Step 19: AI Assistant usage log
-- ============================================================================
-- Run this in the Supabase SQL editor. Safe to re-run.
--
-- What this creates:
--   ai_usage_events — one row per assistant request, used for BOTH the
--   application-level daily rate limit and the observability the AI layer
--   needs (which provider answered, whether it fell back, how long it took).
--
-- DELIBERATELY NOT STORED: message text, tool arguments, or result payloads.
-- The limit only needs counts and the log only needs shape — keeping the
-- user's actual conversation out of the database means a breach of this table
-- leaks usage patterns, not what anyone asked. Conversation continuity is
-- held in the client's React state for the life of the tab instead.
--
-- The rate limit reads this table through the *user's* client (RLS below lets
-- a user count only their own rows) and writes through the service-role
-- client. There is deliberately no INSERT policy: a user who could insert
-- their own usage rows could not inflate their limit, but a user who could
-- DELETE them could reset it, so writes stay entirely server-side.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Which provider actually produced the answer, and whether it was the
  -- fallback rather than the primary. `fell_back = TRUE` accumulating is the
  -- signal that the primary provider is degraded — without this column a
  -- Gemini outage looks identical to normal operation from the outside.
  provider      TEXT NOT NULL,
  model         TEXT NOT NULL,
  fell_back     BOOLEAN NOT NULL DEFAULT FALSE,

  -- How many tools the model actually invoked, and how many records came
  -- back. `tool_calls > 0 AND result_count = 0` is the "searched and found
  -- nothing" case, which reads very differently from `tool_calls = 0`
  -- (answered from conversation alone) when diagnosing a complaint that the
  -- assistant "didn't find anything".
  tool_calls    SMALLINT NOT NULL DEFAULT 0,
  result_count  SMALLINT NOT NULL DEFAULT 0,

  latency_ms    INTEGER,
  -- Null on success. Short reason string only, never a raw provider payload.
  error         TEXT
);

-- The rate-limit query's exact shape: "how many rows for this user since
-- midnight". Descending created_at also serves the admin-side recent view.
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created
  ON ai_usage_events (user_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE ai_usage_events ENABLE ROW LEVEL SECURITY;

-- A user may count/read only their own usage. No INSERT, UPDATE, or DELETE
-- policy for anon or authenticated at all — every write goes through the
-- service-role client, which bypasses RLS.
DROP POLICY IF EXISTS "ai_usage_read_own" ON ai_usage_events;
CREATE POLICY "ai_usage_read_own" ON ai_usage_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- Done. Test:
--
--   -- As service role, insert a row for a real user id:
--   INSERT INTO ai_usage_events (user_id, provider, model, tool_calls)
--   VALUES ('<some-user-uuid>', 'gemini', 'gemini-2.5-flash', 1);
--
--   -- As that signed-in user, this returns their own row:
--   SELECT id, provider, created_at FROM ai_usage_events;
--
--   -- As a different signed-in user, the same query returns zero rows.
--
--   -- As any signed-in user, this should FAIL (no INSERT policy):
--   INSERT INTO ai_usage_events (user_id, provider, model) VALUES (auth.uid(), 'x', 'y');
-- ============================================================================

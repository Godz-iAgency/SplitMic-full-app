import { createClient } from "@supabase/supabase-js";
import { syncLiveEvents } from "../lib/events/sync";

/**
 * Verification-only: replays the sync with a caller-supplied "now" so the
 * mapping/filtering path can be exercised even when every show on today's
 * listing has already started (running this late at night otherwise reports a
 * legitimate but uninformative zero).
 *
 * Always a dry run — this never writes.
 *
 *   npx tsx scripts/verifySyncPipeline.mts 2026-08-13T14:00:00Z
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env vars.");
  process.exit(1);
}

const nowArg = process.argv[2];
const now = nowArg ? new Date(nowArg) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error(`Not a valid date: ${nowArg}`);
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log(`Replaying sync as of ${now.toISOString()} (dry run — writes nothing)`);
const result = await syncLiveEvents(supabase, { dryRun: true, now });
console.log(JSON.stringify(result, null, 2));

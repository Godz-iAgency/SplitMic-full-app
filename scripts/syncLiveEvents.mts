import { createClient } from "@supabase/supabase-js";
import { syncLiveEvents } from "../lib/events/sync";

/**
 * One-off runner for the Do512 → live_events sync, for triggering it by hand
 * instead of waiting for the daily Vercel cron. Reuses the exact same job the
 * cron route calls.
 *
 *   npx tsx scripts/syncLiveEvents.mts           # real run
 *   npx tsx scripts/syncLiveEvents.mts --dry-run # report only, writes nothing
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!process.env.FIRECRAWL_API_KEY) {
  console.error("Missing FIRECRAWL_API_KEY — the Do512 scrape can't run without it.");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const supabase = createClient(url, key, { auth: { persistSession: false } });

const result = await syncLiveEvents(supabase, { dryRun });

console.log(JSON.stringify(result, null, 2));
process.exit(result.error ? 1 : 0);

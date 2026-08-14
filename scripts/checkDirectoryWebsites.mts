import { createClient } from "@supabase/supabase-js";
import { checkWebsites, deactivateDeadListings } from "../lib/directory/websiteCheckJob";

/**
 * One-off runner for the website-liveness backfill against the live database,
 * used from the command line instead of clicking through /admin/directory in
 * a browser. Reuses the exact same job code the admin panel calls, so the
 * classification and status writes are identical either way.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  let live = 0;
  let dead = 0;
  let uncertain = 0;
  let skipped = 0;
  let attempted = 0;
  const deadListings: { businessName: string; websiteUrl: string; reason: string }[] = [];

  for (;;) {
    const res = await checkWebsites(supabase, { limit: 50 });
    if (res.error) {
      console.error("Job error:", res.error);
      process.exit(1);
    }
    if (res.attempted === 0) break;

    live += res.live;
    dead += res.dead;
    uncertain += res.uncertain;
    skipped += res.skipped;
    attempted += res.attempted;
    deadListings.push(...res.deadListings);

    const remaining = Math.max(0, res.remainingBefore - res.attempted);
    console.log(
      `checked ${attempted} so far (live ${live}, dead ${dead}, uncertain ${uncertain}, no-site ${skipped}) — ${remaining} left`,
    );
  }

  console.log("\n=== Check complete ===");
  console.log(`live: ${live}  dead: ${dead}  uncertain: ${uncertain}  no_website: ${skipped}`);

  if (dead === 0) {
    console.log("Nothing confirmed dead — nothing to deactivate.");
    return;
  }

  console.log(`\nDeactivating ${dead} confirmed-dead listing(s)...`);
  const result = await deactivateDeadListings(supabase);
  if (result.error) {
    console.error("Deactivate error:", result.error);
    process.exit(1);
  }

  console.log(`Deactivated ${result.deactivated} listing(s):`);
  for (const b of result.businesses) {
    console.log(`  - ${b.businessName} (${b.websiteUrl}) — ${b.reason}`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

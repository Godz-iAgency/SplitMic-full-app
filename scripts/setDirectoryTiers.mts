import { createClient } from "@supabase/supabase-js";

/**
 * One-off runner to promote a hand-picked set of directory listings to
 * featured/spotlight. Bypasses the adminSetDirectoryTier server action (which
 * needs a real cookie session) but replicates its two effects exactly: the
 * tier update, and an admin_action_log row per business — this repo's stated
 * convention is to preserve an auditable history wherever one already exists,
 * and this is the same table the app's own per-row tier control writes to.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env vars.");
  process.exit(1);
}

const ADMIN_USER_ID = "cf9123ba-4e19-4ae8-b077-39c742150acb";
const ADMIN_EMAIL = "christopher@godz-iagency.com";

const PICKS: { id: string; tier: "featured" | "spotlight"; businessName: string }[] = [
  { id: "427ecb2b-7ae8-4acf-ba15-65be9e0b9ab9", tier: "spotlight", businessName: "Antone's Nightclub" },
  { id: "bb33631f-401d-4510-8761-46c91fe637e1", tier: "featured", businessName: "3 Ten ACL Live" },
  { id: "987e326c-0dcc-4a55-96a8-1838f0860eeb", tier: "featured", businessName: "Austin City Limits Live at Moody Theater | ACL Live" },
  { id: "fb359999-a6de-4bb6-8f60-17a79df2899f", tier: "featured", businessName: "Austin Beer Garden Brewing Co. (the ABGB)" },
  { id: "87d06c3b-403c-4afb-93af-b6b64cc92f5c", tier: "spotlight", businessName: "(RAS) Riders Against the Storm" },
  { id: "60027b7a-48f6-4476-8911-817a49f93073", tier: "featured", businessName: "Amplified Heat" },
  { id: "2409623a-0268-4b3f-81a1-9290781a3e24", tier: "featured", businessName: "A Band Called Ma" },
  { id: "6a4d3fba-4317-44c3-8161-57b5598048e4", tier: "spotlight", businessName: "Austin City Limits Music Festival" },
  { id: "857c4252-d8b7-4831-b14c-a577f4c2389f", tier: "featured", businessName: "Austin Reggae Festival" },
  { id: "e455e7ec-17cf-44c8-9c11-2c60a34e99a7", tier: "featured", businessName: "Eastside Kings Festival" },
  { id: "a891ac0a-820f-4772-a504-3e0297601c7c", tier: "spotlight", businessName: "Holodeck Records" },
  { id: "e7a1e5bb-138d-45c6-956d-23fc3a0bb797", tier: "featured", businessName: "Fable Records" },
  { id: "e7b1ae11-24fd-4efd-a39d-ef9c874db92b", tier: "featured", businessName: "Come and Take It Productions" },
  { id: "45acb1cb-4566-4e1a-899e-fb85619458cc", tier: "featured", businessName: "Sonance Rehearsal Studios (location #1)" },
  { id: "6c5b7228-cc1e-4708-98db-29d7bad47883", tier: "featured", businessName: "Strait Music Company" },
  { id: "ad5ab936-04a1-4518-aeaa-1a438113a296", tier: "featured", businessName: "ATX Backline" },
];

const dryRun = process.argv.includes("--dry-run");
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  console.log(`${dryRun ? "[dry run] " : ""}Promoting ${PICKS.length} listings...`);
  const nowIso = new Date().toISOString();
  let ok = 0;

  for (const pick of PICKS) {
    if (dryRun) {
      console.log(`  would set ${pick.businessName} -> ${pick.tier}`);
      continue;
    }

    const { error: updateError } = await supabase
      .from("directory_businesses")
      .update({ tier: pick.tier, updated_at: nowIso })
      .eq("id", pick.id);

    if (updateError) {
      console.error(`  FAILED ${pick.businessName}: ${updateError.message}`);
      continue;
    }

    const { error: logError } = await supabase.from("admin_action_log").insert({
      admin_user_id: ADMIN_USER_ID,
      admin_email: ADMIN_EMAIL,
      action_type: "directory_set_tier",
      target_type: "directory_business",
      target_id: pick.id,
      target_label: pick.businessName,
      details: { tier: pick.tier, source: "scripts/setDirectoryTiers.mts" },
    });

    if (logError) {
      console.error(`  tier set but log FAILED for ${pick.businessName}: ${logError.message}`);
      continue;
    }

    console.log(`  ${pick.businessName} -> ${pick.tier}`);
    ok += 1;
  }

  console.log(`\nDone: ${ok}/${PICKS.length} succeeded.`);
}

main();

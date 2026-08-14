import type { SupabaseClient } from "@supabase/supabase-js";
import { checkWebsiteLive } from "./websiteCheck";

/**
 * Checks each directory listing's website a batch at a time, and separately
 * lets an admin retire the ones confirmed dead.
 *
 * Free — no API key, no billing — but still batched like the other jobs: it
 * only ever picks up rows never checked (website_status IS NULL), so
 * re-running never rechecks a business that already has an answer, and a
 * partial run just picks up where it left off.
 */

export const WEBSITE_CHECK_BATCH_SIZE = 25;

export type DeadListing = {
  id: string;
  businessName: string;
  websiteUrl: string;
  reason: string;
};

export type WebsiteCheckJobResult = {
  /** Rows never checked, before this run. */
  remainingBefore: number;
  attempted: number;
  live: number;
  dead: number;
  uncertain: number;
  /** No website URL to check at all. */
  skipped: number;
  dryRun: boolean;
  deadListings: DeadListing[];
  error?: string;
};

export type WebsiteCheckJobOptions = {
  limit?: number;
  dryRun?: boolean;
  now?: Date;
};

type PendingRow = {
  id: string;
  business_name: string;
  website_url: string | null;
};

const emptyResult = (dryRun: boolean): WebsiteCheckJobResult => ({
  remainingBefore: 0,
  attempted: 0,
  live: 0,
  dead: 0,
  uncertain: 0,
  skipped: 0,
  dryRun,
  deadListings: [],
});

export async function checkWebsites(
  supabase: SupabaseClient,
  options: WebsiteCheckJobOptions = {},
): Promise<WebsiteCheckJobResult> {
  const limit = options.limit ?? WEBSITE_CHECK_BATCH_SIZE;
  const dryRun = options.dryRun ?? false;
  const nowIso = (options.now ?? new Date()).toISOString();

  const { count: remainingBefore, error: countError } = await supabase
    .from("directory_businesses")
    .select("id", { count: "exact", head: true })
    .is("website_status", null);

  if (countError) return { ...emptyResult(dryRun), error: countError.message };

  const { data, error: selectError } = await supabase
    .from("directory_businesses")
    .select("id, business_name, website_url")
    .is("website_status", null)
    // Highest-visibility listings get confirmed first.
    .order("tier_rank", { ascending: true })
    .order("business_name", { ascending: true })
    .limit(limit);

  if (selectError) return { ...emptyResult(dryRun), error: selectError.message };

  const rows = (data ?? []) as PendingRow[];
  const base: WebsiteCheckJobResult = {
    ...emptyResult(dryRun),
    remainingBefore: remainingBefore ?? 0,
    attempted: rows.length,
  };

  if (rows.length === 0 || dryRun) return base;

  let live = 0;
  let dead = 0;
  let uncertain = 0;
  let skipped = 0;
  const deadListings: DeadListing[] = [];

  // Sequential on purpose: predictable runtime, easy to reason about mid-batch,
  // same as the screenshot and OG-image jobs.
  for (const row of rows) {
    if (!row.website_url) {
      await mark(supabase, row.id, { status: "no_website", nowIso });
      skipped += 1;
      continue;
    }

    const result = await checkWebsiteLive(row.website_url);
    await mark(supabase, row.id, {
      status: result.status,
      nowIso,
      httpStatus: result.httpStatus,
      reason: result.reason,
    });

    if (result.status === "live") live += 1;
    else if (result.status === "uncertain") uncertain += 1;
    else {
      dead += 1;
      deadListings.push({
        id: row.id,
        businessName: row.business_name,
        websiteUrl: row.website_url,
        reason: result.reason,
      });
    }
  }

  return { ...base, live, dead, uncertain, skipped, deadListings };
}

async function mark(
  supabase: SupabaseClient,
  id: string,
  args: {
    status: "live" | "dead" | "uncertain" | "no_website";
    nowIso: string;
    httpStatus?: number | null;
    reason?: string;
  },
): Promise<void> {
  await supabase
    .from("directory_businesses")
    .update({
      website_status: args.status,
      website_checked_at: args.nowIso,
      website_http_status: args.httpStatus ?? null,
      website_check_reason: args.reason ?? null,
      updated_at: args.nowIso,
    })
    .eq("id", id);
}

/** Puts dead/uncertain rows back in the queue for an explicit retry. */
export async function resetWebsiteChecks(
  supabase: SupabaseClient,
  statuses: ("dead" | "uncertain")[] = ["dead", "uncertain"],
): Promise<{ reset: number; error?: string }> {
  const { count, error } = await supabase
    .from("directory_businesses")
    .update({ website_status: null }, { count: "exact" })
    .in("website_status", statuses);

  if (error) return { reset: 0, error: error.message };
  return { reset: count ?? 0 };
}

/**
 * Hides every confirmed-dead listing from the public directory. This is a
 * soft removal (`is_active = false`, same flag the manual per-row toggle
 * uses) rather than a DELETE — reversible, and it keeps the outreach history
 * on a business that might come back with a new site.
 */
export async function deactivateDeadListings(
  supabase: SupabaseClient,
): Promise<{ deactivated: number; businesses: DeadListing[]; error?: string }> {
  const { data, error: selectError } = await supabase
    .from("directory_businesses")
    .select("id, business_name, website_url, website_check_reason")
    .eq("website_status", "dead")
    .eq("is_active", true);

  if (selectError) return { deactivated: 0, businesses: [], error: selectError.message };

  const rows = data ?? [];
  if (rows.length === 0) return { deactivated: 0, businesses: [] };

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("directory_businesses")
    .update({ is_active: false, updated_at: nowIso })
    .eq("website_status", "dead")
    .eq("is_active", true);

  if (updateError) return { deactivated: 0, businesses: [], error: updateError.message };

  return {
    deactivated: rows.length,
    businesses: rows.map((row) => ({
      id: row.id,
      businessName: row.business_name,
      websiteUrl: row.website_url ?? "",
      reason: row.website_check_reason ?? "",
    })),
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchOgImage } from "./ogImage";

/**
 * Backfills each listing's Open Graph preview image, a batch at a time.
 *
 * Free — no API key, no billing — but still batched and resumable like the
 * screenshot job: it only ever picks up rows never checked
 * (og_image_status IS NULL), so re-running never re-fetches a business that
 * already has an answer, and a partial run just picks up where it left off.
 *
 * Unlike the screenshot pipeline, the found image URL is stored directly
 * rather than downloaded and re-hosted — it points at the business's own
 * website, which is expected to stay stable, not a signed/temporary link.
 */

/** Free, but still bounded per run to keep one admin click's runtime sane. */
export const OG_IMAGE_BATCH_SIZE = 25;

export type OgImageJobResult = {
  /** Rows never checked, before this run. */
  remainingBefore: number;
  attempted: number;
  found: number;
  /** Page loaded fine, just has no og:image/twitter:image set. */
  noImage: number;
  failed: number;
  /** No website URL to check at all. */
  skipped: number;
  dryRun: boolean;
  failures: { businessName: string; reason: string }[];
  error?: string;
};

export type OgImageJobOptions = {
  limit?: number;
  dryRun?: boolean;
  now?: Date;
};

type PendingRow = {
  id: string;
  business_name: string;
  website_url: string | null;
};

const emptyResult = (dryRun: boolean): OgImageJobResult => ({
  remainingBefore: 0,
  attempted: 0,
  found: 0,
  noImage: 0,
  failed: 0,
  skipped: 0,
  dryRun,
  failures: [],
});

export async function backfillOgImages(
  supabase: SupabaseClient,
  options: OgImageJobOptions = {},
): Promise<OgImageJobResult> {
  const limit = options.limit ?? OG_IMAGE_BATCH_SIZE;
  const dryRun = options.dryRun ?? false;
  const nowIso = (options.now ?? new Date()).toISOString();

  const { count: remainingBefore, error: countError } = await supabase
    .from("directory_businesses")
    .select("id", { count: "exact", head: true })
    .is("og_image_status", null);

  if (countError) return { ...emptyResult(dryRun), error: countError.message };

  const { data, error: selectError } = await supabase
    .from("directory_businesses")
    .select("id, business_name, website_url")
    .is("og_image_status", null)
    // Highest-visibility listings get pictures first, so a partial backfill
    // still improves the top of every page.
    .order("tier_rank", { ascending: true })
    .order("business_name", { ascending: true })
    .limit(limit);

  if (selectError) return { ...emptyResult(dryRun), error: selectError.message };

  const rows = (data ?? []) as PendingRow[];
  const base: OgImageJobResult = {
    ...emptyResult(dryRun),
    remainingBefore: remainingBefore ?? 0,
    attempted: rows.length,
  };

  if (rows.length === 0 || dryRun) return base;

  let found = 0;
  let noImage = 0;
  let failed = 0;
  let skipped = 0;
  const failures: OgImageJobResult["failures"] = [];

  // Sequential on purpose: keeps behavior predictable and a mid-batch failure
  // easy to reason about, same as the screenshot job.
  for (const row of rows) {
    if (!row.website_url) {
      await mark(supabase, row.id, { status: "skipped", nowIso });
      skipped += 1;
      continue;
    }

    const result = await fetchOgImage(row.website_url);
    if (!result.ok) {
      await mark(supabase, row.id, { status: "failed", nowIso });
      failed += 1;
      failures.push({ businessName: row.business_name, reason: result.reason });
      continue;
    }

    if (!result.url) {
      await mark(supabase, row.id, { status: "no_image", nowIso });
      noImage += 1;
      continue;
    }

    await mark(supabase, row.id, {
      status: "done",
      nowIso,
      ogImageUrl: result.url,
    });
    found += 1;
  }

  return { ...base, found, noImage, failed, skipped, failures };
}

async function mark(
  supabase: SupabaseClient,
  id: string,
  args: {
    status: "done" | "no_image" | "failed" | "skipped";
    nowIso: string;
    ogImageUrl?: string;
  },
): Promise<void> {
  await supabase
    .from("directory_businesses")
    .update({
      og_image_status: args.status,
      og_image_checked_at: args.nowIso,
      updated_at: args.nowIso,
      ...(args.ogImageUrl ? { og_image_url: args.ogImageUrl } : {}),
    })
    .eq("id", id);
}

/** Puts failed lookups back in the queue for an explicit retry. */
export async function resetFailedOgImages(
  supabase: SupabaseClient,
): Promise<{ reset: number; error?: string }> {
  const { count, error } = await supabase
    .from("directory_businesses")
    .update({ og_image_status: null }, { count: "exact" })
    .eq("og_image_status", "failed");

  if (error) return { reset: 0, error: error.message };
  return { reset: count ?? 0 };
}

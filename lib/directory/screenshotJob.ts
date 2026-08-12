import type { SupabaseClient } from "@supabase/supabase-js";
import { captureScreenshot } from "./screenshots";
import {
  uploadRemoteImage,
  directoryScreenshotPath,
} from "@/lib/media/serverUpload";

/**
 * Backfills website screenshots onto directory listings, a batch at a time.
 *
 * Every capture costs a Firecrawl credit, so this is deliberately incremental
 * and resumable: it only ever picks up rows that have never been attempted
 * (screenshot_status IS NULL), and marks the outcome on every row it touches.
 * A row is therefore never captured — or paid for — twice, no matter how many
 * times the job runs.
 *
 * It also skips any row that already has a free Open Graph image
 * (og_image_url IS NOT NULL) — the card prefers that image over a screenshot
 * anyway, so paying to screenshot a business that already has a real photo
 * would be a pure wasted credit. Run the free lookup first.
 */

/** Small by default: each run should be a deliberate, bounded spend. */
export const SCREENSHOT_BATCH_SIZE = 25;

export type ScreenshotJobResult = {
  /** Rows still never attempted, before this run. */
  remainingBefore: number;
  attempted: number;
  captured: number;
  failed: number;
  /** Rows with no website — marked skipped so they stop being picked up. */
  skipped: number;
  dryRun: boolean;
  /** Per-row failure reasons, for showing in the admin panel. */
  failures: { businessName: string; reason: string }[];
  error?: string;
};

export type ScreenshotJobOptions = {
  limit?: number;
  dryRun?: boolean;
  now?: Date;
};

type PendingRow = {
  id: string;
  business_name: string;
  website_url: string | null;
};

const emptyResult = (dryRun: boolean): ScreenshotJobResult => ({
  remainingBefore: 0,
  attempted: 0,
  captured: 0,
  failed: 0,
  skipped: 0,
  dryRun,
  failures: [],
});

export async function backfillScreenshots(
  supabase: SupabaseClient,
  options: ScreenshotJobOptions = {},
): Promise<ScreenshotJobResult> {
  const limit = options.limit ?? SCREENSHOT_BATCH_SIZE;
  const dryRun = options.dryRun ?? false;
  const nowIso = (options.now ?? new Date()).toISOString();

  const { count: remainingBefore, error: countError } = await supabase
    .from("directory_businesses")
    .select("id", { count: "exact", head: true })
    .is("screenshot_status", null)
    .is("og_image_url", null);

  if (countError) {
    return { ...emptyResult(dryRun), error: countError.message };
  }

  const { data, error: selectError } = await supabase
    .from("directory_businesses")
    .select("id, business_name, website_url")
    .is("screenshot_status", null)
    // Skip anything that already has a free photo — the card prefers it over
    // a screenshot anyway, so capturing one here would just spend a credit
    // for nothing.
    .is("og_image_url", null)
    // Highest-visibility listings get pictures first, so a partial backfill
    // still improves the top of every page.
    .order("tier_rank", { ascending: true })
    .order("business_name", { ascending: true })
    .limit(limit);

  if (selectError) {
    return { ...emptyResult(dryRun), error: selectError.message };
  }

  const rows = (data ?? []) as PendingRow[];
  const base: ScreenshotJobResult = {
    ...emptyResult(dryRun),
    remainingBefore: remainingBefore ?? 0,
    attempted: rows.length,
  };

  if (rows.length === 0 || dryRun) return base;

  let captured = 0;
  let failed = 0;
  let skipped = 0;
  const failures: ScreenshotJobResult["failures"] = [];

  // Sequential on purpose: parallel captures would spike Firecrawl concurrency
  // and make a partial failure much harder to reason about mid-batch.
  for (const row of rows) {
    if (!row.website_url) {
      await mark(supabase, row.id, { status: "skipped", nowIso });
      skipped += 1;
      continue;
    }

    const shot = await captureScreenshot(row.website_url);
    if (!shot.ok) {
      await mark(supabase, row.id, { status: "failed", nowIso });
      failed += 1;
      failures.push({ businessName: row.business_name, reason: shot.reason });
      continue;
    }

    const stored = await uploadRemoteImage(
      supabase,
      shot.url,
      directoryScreenshotPath(row.id),
    );
    if (!stored.ok) {
      await mark(supabase, row.id, { status: "failed", nowIso });
      failed += 1;
      failures.push({ businessName: row.business_name, reason: stored.reason });
      continue;
    }

    await mark(supabase, row.id, {
      status: "done",
      nowIso,
      screenshotUrl: stored.publicUrl,
    });
    captured += 1;
  }

  return { ...base, captured, failed, skipped, failures };
}

async function mark(
  supabase: SupabaseClient,
  id: string,
  args: {
    status: "done" | "failed" | "skipped";
    nowIso: string;
    screenshotUrl?: string;
  },
): Promise<void> {
  await supabase
    .from("directory_businesses")
    .update({
      screenshot_status: args.status,
      screenshot_captured_at: args.nowIso,
      updated_at: args.nowIso,
      ...(args.screenshotUrl ? { screenshot_url: args.screenshotUrl } : {}),
    })
    .eq("id", id);
}

/**
 * Clears `failed` back to unattempted so the next run retries them. Separate
 * from the main job so a transient outage doesn't silently re-bill on every
 * subsequent batch — retrying is always an explicit choice.
 */
export async function resetFailedScreenshots(
  supabase: SupabaseClient,
): Promise<{ reset: number; error?: string }> {
  const { count, error } = await supabase
    .from("directory_businesses")
    .update({ screenshot_status: null }, { count: "exact" })
    .eq("screenshot_status", "failed");

  if (error) return { reset: 0, error: error.message };
  return { reset: count ?? 0 };
}

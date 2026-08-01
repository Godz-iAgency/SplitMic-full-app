import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Housekeeping: permanently remove marketplace posts that expired long ago.
 *
 * Two different clocks act on a post, and they are NOT the same thing:
 *
 *   1. Soft expiry — 7 days after the event / open-until date. Computed by a
 *      DB trigger into `expires_at`, and every browse query filters on it.
 *      This is what makes a post disappear from the Feed. It deletes nothing.
 *   2. Retention (this file) — a year after that, the row is actually deleted.
 *
 * The gap between the two exists on purpose. A post is the ONLY place a show's
 * history lives: `event_band_tags` (which bands accepted the gig) and
 * `open_mic_signups` (the running order and who checked in) both hang off the
 * post with ON DELETE CASCADE. Deleting a post at soft expiry would wipe a
 * venue's open-mic roster one week after the night happened.
 *
 * So retention is deliberately long, and this job reports exactly how many
 * child rows a run would take with it.
 */

/** Keep a full year of history past the point a post stops being shown. */
export const DEFAULT_RETENTION_DAYS = 365;

/**
 * Most posts to delete in a single run. The job is idempotent — if a backlog
 * ever exceeds this, the next run picks up where this one stopped, rather than
 * building one enormous `in (...)` clause.
 */
export const CLEANUP_BATCH_SIZE = 500;

/** Refuse to run with a retention window short enough to eat live history. */
const MIN_RETENTION_DAYS = 30;

export type CleanupResult = {
  /**
   * Posts with `expires_at` strictly before this date were in scope.
   * Empty string when the run was rejected before a cutoff was computed.
   */
  cutoffDate: string;
  postsDeleted: number;
  /** Child rows that went with them (or would have, on a dry run). */
  eventTagsRemoved: number;
  openMicSignupsRemoved: number;
  dryRun: boolean;
  /** True when the batch filled up and more posts are still eligible. */
  moreRemaining: boolean;
  error?: string;
};

export type CleanupOptions = {
  retentionDays?: number;
  /** Count what would be deleted and report it, without deleting. */
  dryRun?: boolean;
  /** Injectable for tests. Defaults to now. */
  now?: Date;
};

const emptyResult = (cutoffDate: string, dryRun: boolean): CleanupResult => ({
  cutoffDate,
  postsDeleted: 0,
  eventTagsRemoved: 0,
  openMicSignupsRemoved: 0,
  dryRun,
  moreRemaining: false,
});

/**
 * Deletes expired marketplace posts older than the retention window.
 *
 * Requires a service-role client: RLS scopes writes to the post's owner, and
 * this runs as a scheduled job with no user session.
 *
 * Never throws — every failure comes back as `error` on the result so a cron
 * caller can log it and move on instead of retrying a half-finished delete.
 */
export async function cleanupExpiredPosts(
  supabase: SupabaseClient,
  options: CleanupOptions = {},
): Promise<CleanupResult> {
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const dryRun = options.dryRun ?? false;

  // Validate BEFORE computing the cutoff: a non-finite retention would make an
  // Invalid Date, and toISOString() throws on those.
  if (!Number.isFinite(retentionDays) || retentionDays < MIN_RETENTION_DAYS) {
    return {
      ...emptyResult("", dryRun),
      error: `Retention must be at least ${MIN_RETENTION_DAYS} days (got ${retentionDays}). A shorter window would delete history that is still in use.`,
    };
  }

  const cutoff = cutoffDate(retentionDays, options.now ?? new Date());

  // 1. Which posts are in scope. Capped, so one run can't build an unbounded query.
  const { data: doomed, error: selectError } = await supabase
    .from("marketplace_posts")
    .select("id")
    .lt("expires_at", cutoff)
    .limit(CLEANUP_BATCH_SIZE);

  if (selectError) {
    return { ...emptyResult(cutoff, dryRun), error: selectError.message };
  }
  if (!doomed || doomed.length === 0) {
    return emptyResult(cutoff, dryRun);
  }

  const ids = doomed.map((p) => p.id as string);

  // 2. Blast radius. Counted BEFORE deleting, because after the cascade there
  //    is nothing left to count and no way to report what was lost.
  const [eventTags, openMicSignups] = await Promise.all([
    countChildren(supabase, "event_band_tags", "marketplace_post_id", ids),
    countChildren(supabase, "open_mic_signups", "post_id", ids),
  ]);

  if (dryRun) {
    return {
      cutoffDate: cutoff,
      postsDeleted: ids.length,
      eventTagsRemoved: eventTags,
      openMicSignupsRemoved: openMicSignups,
      dryRun: true,
      moreRemaining: ids.length === CLEANUP_BATCH_SIZE,
    };
  }

  // 3. Delete. event_band_tags and open_mic_signups cascade automatically;
  //    connection_requests.related_post_id is ON DELETE SET NULL, so those
  //    requests survive and just lose the link to the post that prompted them.
  const { error: deleteError } = await supabase
    .from("marketplace_posts")
    .delete()
    .in("id", ids);

  if (deleteError) {
    return { ...emptyResult(cutoff, dryRun), error: deleteError.message };
  }

  return {
    cutoffDate: cutoff,
    postsDeleted: ids.length,
    eventTagsRemoved: eventTags,
    openMicSignupsRemoved: openMicSignups,
    dryRun: false,
    moreRemaining: ids.length === CLEANUP_BATCH_SIZE,
  };
}

/** `expires_at` is a DATE column, so this compares as a plain YYYY-MM-DD. */
export function cutoffDate(retentionDays: number, now: Date): string {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - Math.round(retentionDays));
  return d.toISOString().slice(0, 10);
}

async function countChildren(
  supabase: SupabaseClient,
  table: string,
  column: string,
  postIds: string[],
): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .in(column, postIds);
  return count ?? 0;
}

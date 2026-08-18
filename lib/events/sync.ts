import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DO512_TODAY_URL,
  DO512_WEEK_URL,
  buildUpcomingDo512DateUrls,
  scrapeDo512Events,
  mapEventToRow,
  type LiveEventInsert,
  type RawDo512Event,
  type Do512Result,
} from "./do512";
import {
  fetchTicketmasterEvents,
  mapTicketmasterEventToRow,
} from "./providers/ticketmaster";
import {
  loadMatchCandidates,
  findMatch,
  loadDirectoryVenueCandidates,
  findDirectoryVenueMatch,
} from "./matching";

/**
 * Orchestrates one daily Do512 → live_events sync. Mirrors
 * lib/supabase/maintenance.ts's shape: a typed result object, never throws,
 * takes a client so it's testable with a fake.
 */

export type SyncResult = {
  eventsScraped: number;
  eventsUpserted: number;
  eventsDeactivated: number;
  /**
   * Scraped events discarded for already being in the past. Surfaced because
   * "scraped 16, upserted 0" reads as healthy on its own — it was, in fact,
   * how a stale-cache bug hid for a full day (Firecrawl kept serving the
   * previous evening's copy of the ".../today" page, so every event had
   * already happened). A high number here against a low upsert count means
   * the source page is stale, not that the night is over.
   */
  eventsSkippedPast: number;
  /** True when at least one (but not all) of this run's Do512 pages could be scraped. */
  partial: boolean;
  dryRun: boolean;
  error?: string;
};

export type SyncOptions = {
  dryRun?: boolean;
  now?: Date;
};

/**
 * How many Do512 scrapes run at once. Measured directly against the real
 * Firecrawl API before choosing this number, in two rounds:
 *
 * First, at the original 6-day weekday lookahead (8 scrapes total): firing
 * all 8 at once left Firecrawl's own processing time degrading under the
 * concurrent load — 6 of 8 calls blew past scrapeDo512Events' timeout.
 * Sequential fixed reliability but took ~90s for all 8, and this app's cron
 * functions run on Vercel's Hobby tier, which hard-kills a function at 60s
 * with no partial result — sequential didn't fit. Concurrency 2 landed
 * 49-59s across repeated runs — fast enough, but one run only completed 7/8
 * before a timeout, and 59s left almost no margin under the 60s ceiling.
 *
 * That reliability gap (not this setting) is why DO512_WEEKDAY_LOOKAHEAD_DAYS
 * is 3 rather than a full week: with 5 total scrapes, concurrency 2
 * (2 rounds of 2, then 1) measured a consistent ~39s with real margin to
 * spare. See that constant for the full reasoning.
 */
const SCRAPE_CONCURRENCY = 2;

/**
 * Runs `fn` over `items` with at most `limit` in flight at once, preserving
 * result order regardless of which call resolves first.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const emptyResult = (dryRun: boolean): SyncResult => ({
  eventsScraped: 0,
  eventsUpserted: 0,
  eventsDeactivated: 0,
  eventsSkippedPast: 0,
  partial: false,
  dryRun,
});

type UpsertResult = {
  eventsUpserted: number;
  eventsDeactivated: number;
  error?: string;
};

/**
 * Shared by every provider (Do512, Ticketmaster, and whatever comes next):
 * matches each row against real SplitMic profiles and the business
 * directory, upserts to `live_events`, and deactivates previously-active
 * rows that no longer appear in this run.
 *
 * Deactivation is scoped to `source` — this is not optional once a second
 * provider exists. The original single-provider version deactivated any
 * active future row absent from the current result set; reused unscoped
 * across two providers running on independent schedules, a Ticketmaster
 * sync would deactivate every Do512 row on every run, since Do512 rows never
 * appear in Ticketmaster's own result set. Each provider may only ever
 * declare its own rows gone.
 */
async function upsertProviderRows(
  supabase: SupabaseClient,
  source: string,
  rows: LiveEventInsert[],
  now: Date,
  dryRun: boolean,
  partial: boolean,
): Promise<UpsertResult> {
  // Attach a matched SplitMic profile, if any, to each row. Independently,
  // also attach a matched directory venue listing — computed regardless of
  // whether a profile matched, since findMatch's band-first short-circuit
  // means a band match never even checks the venue against profiles. See
  // matching.ts for why these two are kept separate.
  const [candidates, directoryVenues] = await Promise.all([
    loadMatchCandidates(supabase),
    loadDirectoryVenueCandidates(supabase),
  ]);
  const rowsWithMatch = rows.map((row) => {
    const match = findMatch(candidates, row.artist_name, row.venue_name);
    const directoryMatch = findDirectoryVenueMatch(directoryVenues, row.venue_name);
    return {
      ...row,
      matched_profile_id: match?.profileId ?? null,
      matched_profile_type: match?.profileType ?? null,
      matched_directory_business_id: directoryMatch,
    };
  });

  if (dryRun) {
    return { eventsUpserted: rowsWithMatch.length, eventsDeactivated: 0 };
  }

  let eventsUpserted = 0;
  if (rowsWithMatch.length > 0) {
    const { error, count } = await supabase
      .from("live_events")
      .upsert(rowsWithMatch, { onConflict: "source_event_id", count: "exact" });
    if (error) return { eventsUpserted: 0, eventsDeactivated: 0, error: error.message };
    eventsUpserted = count ?? rowsWithMatch.length;
  }

  // Deactivate previously-seen future events from THIS source that no longer
  // appear (cancelled/removed) — only when every page scraped successfully
  // this run, so a partial scrape never wrongly hides a real, still-upcoming
  // show that just wasn't on the one page we managed to fetch.
  let eventsDeactivated = 0;
  if (!partial) {
    const currentIds = rowsWithMatch.map((row) => row.source_event_id);
    let query = supabase
      .from("live_events")
      .update({ is_active: false, updated_at: now.toISOString() }, { count: "exact" })
      .eq("is_active", true)
      .eq("source", source)
      .gte("event_datetime", now.toISOString());
    query =
      currentIds.length > 0
        ? query.not("source_event_id", "in", `(${currentIds.join(",")})`)
        : query;
    const { error, count } = await query;
    if (error) {
      return {
        eventsUpserted,
        eventsDeactivated: 0,
        error: `Upsert succeeded but deactivation failed: ${error.message}`,
      };
    }
    eventsDeactivated = count ?? 0;
  }

  return { eventsUpserted, eventsDeactivated };
}

export async function syncLiveEvents(
  supabase: SupabaseClient,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const dryRun = options.dryRun ?? false;
  const now = options.now ?? new Date();

  // today + weekend (as before) plus one page per upcoming weekday — see
  // DO512_WEEKDAY_LOOKAHEAD_DAYS for why neither of the first two alone
  // covers a full week. Concurrency is deliberately limited — see
  // SCRAPE_CONCURRENCY for why running all 8 at once isn't safe.
  const urls = [DO512_TODAY_URL, DO512_WEEK_URL, ...buildUpcomingDo512DateUrls(now)];
  const results: Do512Result<RawDo512Event[]>[] = await mapWithConcurrency(
    urls,
    SCRAPE_CONCURRENCY,
    scrapeDo512Events,
  );

  if (results.every((r) => !r.ok)) {
    // Every page failed — Do512/Firecrawl is down. Fail closed: don't touch
    // the table at all, so a transient outage never wipes the feed.
    const reasons = results.map((r) => (r as { reason: string }).reason).join(" / ");
    return {
      ...emptyResult(dryRun),
      error: `Do512 scrape failed: ${reasons}`,
    };
  }

  const raw: RawDo512Event[] = results.flatMap((r) => (r.ok ? r.data : []));

  // Map + dedupe by the derived source_event_id (the same show can appear on
  // both the "today" and "this week" pages).
  const bySourceId = new Map<string, LiveEventInsert>();
  for (const event of raw) {
    const row = mapEventToRow(event, now);
    if (!row) continue; // unschedulable (no parseable date/time) — skipped
    bySourceId.set(row.source_event_id, row);
  }

  // Only keep events that haven't already happened.
  const mapped = [...bySourceId.values()];
  const rows = mapped.filter(
    (row) => new Date(row.event_datetime).getTime() >= now.getTime(),
  );
  const eventsSkippedPast = mapped.length - rows.length;

  // Some sources failed while at least one succeeded (the all-failed case
  // already returned above) — any missing page means the scraped set isn't
  // the full picture this run.
  const partial = results.some((r) => !r.ok);

  const upsertResult = await upsertProviderRows(supabase, "do512", rows, now, dryRun, partial);

  return {
    eventsScraped: raw.length,
    eventsUpserted: upsertResult.eventsUpserted,
    eventsDeactivated: upsertResult.eventsDeactivated,
    eventsSkippedPast,
    partial,
    dryRun,
    ...(upsertResult.error ? { error: upsertResult.error } : {}),
  };
}

/**
 * Orchestrates one Ticketmaster → live_events sync. Deliberately a sibling
 * of syncLiveEvents (Do512), not a merged/parameterized version of it: the
 * two providers run on independent schedules (Do512 daily via Vercel cron,
 * Ticketmaster every ~4h via an external trigger — see
 * app/api/cron/sync-ticketmaster/route.ts for why Vercel's own cron can't do
 * that on this plan), so there's no single "the scrape" moment to share
 * between them. What IS shared — matching against real profiles/directory,
 * upserting, and source-scoped deactivation — lives in upsertProviderRows
 * and is reused as-is.
 *
 * Same never-throws, typed-result shape as syncLiveEvents.
 */
export async function syncTicketmasterEvents(
  supabase: SupabaseClient,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const dryRun = options.dryRun ?? false;
  const now = options.now ?? new Date();

  const result = await fetchTicketmasterEvents(now);
  if (!result.ok) {
    // Ticketmaster is down or misconfigured. Fail closed: don't touch the
    // table, so a transient outage never wipes out real ticketed listings.
    return { ...emptyResult(dryRun), error: `Ticketmaster fetch failed: ${result.reason}` };
  }

  // Dedupe defensively by source_event_id in case Ticketmaster's pagination
  // ever returns an overlapping event across two pages (Ticketmaster's ids
  // are already unique per event, so in practice this only ever collapses
  // true duplicates, never distinct shows).
  const bySourceId = new Map<string, LiveEventInsert>();
  for (const event of result.data) {
    const row = mapTicketmasterEventToRow(event, now);
    if (!row) continue; // unschedulable or unnamed — skipped
    bySourceId.set(row.source_event_id, row);
  }

  const mapped = [...bySourceId.values()];
  const rows = mapped.filter(
    (row) => new Date(row.event_datetime).getTime() >= now.getTime(),
  );
  const eventsSkippedPast = mapped.length - rows.length;

  // A single fetch either fully succeeds or fails closed above — there's no
  // "some pages failed" state the way Do512's multi-page scrape has, so this
  // is never partial. Deactivation always runs on a successful fetch.
  const partial = false;

  const upsertResult = await upsertProviderRows(
    supabase,
    "ticketmaster",
    rows,
    now,
    dryRun,
    partial,
  );

  return {
    eventsScraped: result.data.length,
    eventsUpserted: upsertResult.eventsUpserted,
    eventsDeactivated: upsertResult.eventsDeactivated,
    eventsSkippedPast,
    partial,
    dryRun,
    ...(upsertResult.error ? { error: upsertResult.error } : {}),
  };
}

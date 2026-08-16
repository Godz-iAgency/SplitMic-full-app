import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DO512_TODAY_URL,
  DO512_WEEK_URL,
  scrapeDo512Events,
  mapEventToRow,
  type LiveEventInsert,
  type RawDo512Event,
} from "./do512";
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
  /** True when only one of the two Do512 pages could be scraped this run. */
  partial: boolean;
  dryRun: boolean;
  error?: string;
};

export type SyncOptions = {
  dryRun?: boolean;
  now?: Date;
};

const emptyResult = (dryRun: boolean): SyncResult => ({
  eventsScraped: 0,
  eventsUpserted: 0,
  eventsDeactivated: 0,
  eventsSkippedPast: 0,
  partial: false,
  dryRun,
});

export async function syncLiveEvents(
  supabase: SupabaseClient,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const dryRun = options.dryRun ?? false;
  const now = options.now ?? new Date();

  const [today, week] = await Promise.all([
    scrapeDo512Events(DO512_TODAY_URL),
    scrapeDo512Events(DO512_WEEK_URL),
  ]);

  if (!today.ok && !week.ok) {
    // Both pages failed — Do512/Firecrawl is down. Fail closed: don't touch
    // the table at all, so a transient outage never wipes the feed.
    return {
      ...emptyResult(dryRun),
      error: `Do512 scrape failed: ${today.reason} / ${week.reason}`,
    };
  }

  const raw: RawDo512Event[] = [
    ...(today.ok ? today.data : []),
    ...(week.ok ? week.data : []),
  ];

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

  const partial = today.ok !== week.ok;

  if (dryRun) {
    return {
      eventsScraped: raw.length,
      eventsUpserted: rowsWithMatch.length,
      eventsDeactivated: 0,
      eventsSkippedPast,
      partial,
      dryRun: true,
    };
  }

  let eventsUpserted = 0;
  if (rowsWithMatch.length > 0) {
    const { error, count } = await supabase
      .from("live_events")
      .upsert(rowsWithMatch, {
        onConflict: "source_event_id",
        count: "exact",
      });
    if (error) {
      return { ...emptyResult(dryRun), error: error.message };
    }
    eventsUpserted = count ?? rowsWithMatch.length;
  }

  // Deactivate previously-seen future events that no longer appear on Do512
  // (cancelled/removed) — only when BOTH pages scraped successfully this
  // run, so a partial scrape never wrongly hides a real, still-upcoming show
  // that just wasn't on the one page we managed to fetch.
  let eventsDeactivated = 0;
  if (!partial) {
    const currentIds = rowsWithMatch.map((row) => row.source_event_id);
    let query = supabase
      .from("live_events")
      .update({ is_active: false, updated_at: now.toISOString() }, { count: "exact" })
      .eq("is_active", true)
      .gte("event_datetime", now.toISOString());
    query =
      currentIds.length > 0
        ? query.not("source_event_id", "in", `(${currentIds.join(",")})`)
        : query;
    const { error, count } = await query;
    if (error) {
      return {
        eventsScraped: raw.length,
        eventsUpserted,
        eventsDeactivated: 0,
        eventsSkippedPast,
        partial,
        dryRun,
        error: `Upsert succeeded but deactivation failed: ${error.message}`,
      };
    }
    eventsDeactivated = count ?? 0;
  }

  return {
    eventsScraped: raw.length,
    eventsUpserted,
    eventsDeactivated,
    eventsSkippedPast,
    partial,
    dryRun,
  };
}

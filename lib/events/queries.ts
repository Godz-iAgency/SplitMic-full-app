import type { SupabaseClient } from "@supabase/supabase-js";
import { dedupeAcrossProviders } from "./dedupe";

/**
 * Card shape the public /live page renders. Provider-agnostic by design —
 * see lib/events/do512.ts's LiveEventInsert docstring for why. `source` is
 * present for lib/events/dedupe.ts's cross-provider duplicate collapsing,
 * not because the frontend needs to know it; components/live/* never
 * branch on it.
 */
export type LiveEventCard = {
  id: string;
  artistName: string;
  venueName: string;
  venueAddress: string | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
  eventDatetime: string;
  isFree: boolean | null;
  imageUrl: string | null;
  ticketUrl: string | null;
  genre: string | null;
  source: string;
  matchedProfileId: string | null;
  matchedProfileType: "band" | "venue" | null;
  /** Matched directory venue listing, re-checked live (not the sync-time
   *  snapshot) so a business deactivated after the match still comes back
   *  null here rather than linking to a hidden listing. */
  directoryBusinessId: string | null;
  /** The matched business's own photo (Open Graph image, else website
   *  screenshot), for the card's image band when Do512 gave no poster. */
  directoryPhotoUrl: string | null;
};

export type UpcomingEventsOptions = {
  /** How many days ahead to fetch, inclusive of today. Default 7. */
  rangeDays?: number;
  /** Injectable for tests. Defaults to now. */
  now?: Date;
};

/**
 * How far back the query reaches so a show already in progress (or one that
 * started earlier tonight) doesn't vanish from the feed the instant its start
 * time passes. 26 hours safely covers the longest possible gap within the
 * 9am-9am "today" cycle (lib/events/time.ts) — an event right at 9:00am,
 * queried just before the next day's 9:00am rollover — with a small margin.
 * The actual "is this still today" call is cycle-aware (isToday); this is
 * just wide enough that the query never excludes something that call would
 * accept.
 */
const LOOKBACK_HOURS = 26;

/**
 * Fetches active events for the public /live page: everything from
 * LOOKBACK_HOURS in the past (so tonight's shows stay visible after they've
 * started) through rangeDays ahead. Fetches the whole range in a single query
 * — the Today/This-Week toggle on the page is a client-side filter over this
 * one result, not a second round trip.
 */
export async function getUpcomingEvents(
  supabase: SupabaseClient,
  options: UpcomingEventsOptions = {},
): Promise<LiveEventCard[]> {
  const rangeDays = options.rangeDays ?? 7;
  const now = options.now ?? new Date();
  const rangeStart = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + rangeDays * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("live_events")
    .select(
      "id, artist_name, venue_name, venue_address, venue_latitude, venue_longitude, event_datetime, is_free, image_url, ticket_url, genre, source, matched_profile_id, matched_profile_type, matched_directory_business_id",
    )
    .eq("is_active", true)
    .gte("event_datetime", rangeStart.toISOString())
    .lte("event_datetime", rangeEnd.toISOString())
    .order("event_datetime", { ascending: true });

  if (error || !data) return [];

  // Re-fetched live rather than trusting the sync-time match: a listing can
  // be deactivated (confirmed dead, see lib/directory/websiteCheck.ts) or get
  // its photo backfilled at any point after the event was synced, and this
  // is the one query that decides what actually renders.
  const directoryIds = [
    ...new Set(
      data
        .map((row) => row.matched_directory_business_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];

  const directoryById = new Map<
    string,
    { ogImageUrl: string | null; screenshotUrl: string | null }
  >();
  if (directoryIds.length > 0) {
    const { data: businesses } = await supabase
      .from("directory_businesses")
      .select("id, og_image_url, screenshot_url")
      .in("id", directoryIds)
      .eq("is_active", true);
    for (const b of businesses ?? []) {
      directoryById.set(b.id as string, {
        ogImageUrl: b.og_image_url,
        screenshotUrl: b.screenshot_url,
      });
    }
  }

  const cards = data.map((row) => {
    const directory = row.matched_directory_business_id
      ? directoryById.get(row.matched_directory_business_id)
      : undefined;

    return {
      id: row.id,
      artistName: row.artist_name,
      venueName: row.venue_name,
      venueAddress: row.venue_address,
      venueLatitude: row.venue_latitude !== null ? Number(row.venue_latitude) : null,
      venueLongitude: row.venue_longitude !== null ? Number(row.venue_longitude) : null,
      eventDatetime: row.event_datetime,
      isFree: row.is_free,
      imageUrl: row.image_url,
      ticketUrl: row.ticket_url,
      genre: row.genre,
      source: row.source,
      matchedProfileId: row.matched_profile_id,
      matchedProfileType: row.matched_profile_type,
      // Only surface the business as matched when it's still active — an id
      // that didn't resolve (deactivated) is treated the same as no match.
      directoryBusinessId: directory ? row.matched_directory_business_id : null,
      directoryPhotoUrl: directory ? directory.ogImageUrl ?? directory.screenshotUrl : null,
    };
  });

  // Collapse the same real-world show reported by two providers (e.g. Do512
  // and Ticketmaster both listing the same gig) into one card. Non-
  // destructive by construction — every row this reads stays in the
  // database untouched; only the rendered list merges. See dedupe.ts for why
  // this can't happen at sync time instead.
  return dedupeAcrossProviders(cards);
}

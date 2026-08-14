import type { SupabaseClient } from "@supabase/supabase-js";

/** Card shape the public /live page renders. */
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
  matchedProfileId: string | null;
  matchedProfileType: "band" | "venue" | null;
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
      "id, artist_name, venue_name, venue_address, venue_latitude, venue_longitude, event_datetime, is_free, image_url, ticket_url, matched_profile_id, matched_profile_type",
    )
    .eq("is_active", true)
    .gte("event_datetime", rangeStart.toISOString())
    .lte("event_datetime", rangeEnd.toISOString())
    .order("event_datetime", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
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
    matchedProfileId: row.matched_profile_id,
    matchedProfileType: row.matched_profile_type,
  }));
}

import type { LiveEventCard } from "./queries";
import { isToday, isUpcoming, cycleDateKey } from "./time";

/**
 * Pure predicate logic for the /live Free/Paid/Genre/Venue filters —
 * extracted the same way lib/events/time.ts's isToday/isUpcoming are, so the
 * actual decision logic ("does this event match the current filters") is
 * unit-tested rather than only reachable by clicking through the rendered
 * page. LiveEventsView.tsx is the only caller.
 */

/**
 * Picks the "Tonight" tab's events. A sync gap (an upstream scrape outage, a
 * cron that hasn't fired yet) must never make this tab show "no shows" — that
 * reads as "nothing's happening in Austin tonight," which is virtually never
 * true, when the real story is just "the data is a bit stale." So: if nothing
 * is dated for today's 9am-9am cycle, fall back to the most recent day that
 * does have listings among what was already fetched, rather than an empty
 * list. Those listings stay up until the next successful sync actually
 * produces something newer — never cleared just because the clock moved on.
 */
export function selectTonightEvents(
  events: LiveEventCard[],
  now: Date = new Date(),
): LiveEventCard[] {
  const todays = events.filter((e) => isToday(e.eventDatetime, now));
  if (todays.length > 0) return todays;

  const notFuture = events.filter((e) => new Date(e.eventDatetime).getTime() <= now.getTime());
  if (notFuture.length === 0) return [];

  const mostRecentKey = notFuture.reduce((latestKey, e) => {
    const key = cycleDateKey(new Date(e.eventDatetime));
    return key > latestKey ? key : latestKey;
  }, "");

  return notFuture.filter((e) => cycleDateKey(new Date(e.eventDatetime)) === mostRecentKey);
}

/**
 * Picks the "This Week" tab's events: everything not tonight, still ahead of
 * now. Same never-blank guarantee as selectTonightEvents — if every non-
 * tonight row happens to have already passed (a stalled sync, not a real
 * quiet week), showing those instead of nothing is still more useful.
 */
export function selectThisWeekEvents(
  events: LiveEventCard[],
  now: Date = new Date(),
): LiveEventCard[] {
  const notTonight = events.filter((e) => !isToday(e.eventDatetime, now));
  const upcoming = notTonight.filter((e) => isUpcoming(e.eventDatetime, now));
  return upcoming.length > 0 ? upcoming : notTonight;
}

export type FreePaid = "all" | "free" | "paid";

/**
 * "Paid" means "not confirmed free," not "confirmed not-free." Most
 * Ticketmaster rows have isFree = null (never guessed at — see
 * lib/events/providers/ticketmaster.ts's mapping) despite being real
 * ticketed shows, so requiring isFree === false here would hide almost
 * every actual ticketed event and leave "Paid" nearly empty. "Free" stays
 * strict (isFree === true only) since that's a claim worth getting right —
 * showing someone a "free" show that then charges at the door is worse than
 * under-filtering.
 */
export function matchesFreePaid(event: LiveEventCard, filter: FreePaid): boolean {
  if (filter === "free") return event.isFree === true;
  if (filter === "paid") return event.isFree !== true;
  return true;
}

/** Empty string means "no filter" for both — matches how the genre/venue
 *  Dropdowns represent their "All ___" option. */
export function matchesGenre(event: LiveEventCard, genre: string): boolean {
  return !genre || event.genre === genre;
}

export function matchesVenue(event: LiveEventCard, venue: string): boolean {
  return !venue || event.venueName === venue;
}

export function matchesAllFilters(
  event: LiveEventCard,
  filters: { freePaid: FreePaid; genre: string; venue: string },
): boolean {
  return (
    matchesFreePaid(event, filters.freePaid) &&
    matchesGenre(event, filters.genre) &&
    matchesVenue(event, filters.venue)
  );
}

/**
 * Builds a Dropdown option value list from whatever distinct values are
 * actually present in a list of events — not a fixed taxonomy. Genre in
 * particular can't reuse lib/genres.ts's curated list: that's SplitMic's own
 * onboarding vocabulary, and Ticketmaster's classification genres
 * ("Alternative Rock", "Hip-Hop/Rap") don't line up with it string-for-
 * string. Showing only values that actually appear in the current feed also
 * guarantees every option returns at least one result when selected.
 */
export function distinctValues(
  events: LiveEventCard[],
  pick: (event: LiveEventCard) => string | null,
): string[] {
  const values = [...new Set(events.map(pick).filter((v): v is string => Boolean(v)))];
  values.sort((a, b) => a.localeCompare(b));
  return values;
}

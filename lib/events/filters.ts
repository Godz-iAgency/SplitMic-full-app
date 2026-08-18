import type { LiveEventCard } from "./queries";

/**
 * Pure predicate logic for the /live Free/Paid/Genre/Venue filters —
 * extracted the same way lib/events/time.ts's isToday/isUpcoming are, so the
 * actual decision logic ("does this event match the current filters") is
 * unit-tested rather than only reachable by clicking through the rendered
 * page. LiveEventsView.tsx is the only caller.
 */

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

/** Austin-local time formatting helpers, shared by server and client components. */

const CHICAGO_TZ = "America/Chicago";

/**
 * "Today" runs 9am-to-9am Chicago time, not midnight-to-midnight — matching
 * when the listing actually refreshes (the daily Do512 sync) rather than the
 * clock. A show that started at 8pm stays "Tonight" all night; it only rolls
 * into "Tomorrow"/history once the *next* 9am sync has run, not at 12:00am.
 */
const CYCLE_START_HOUR = 9;

/** en-CA gives a plain YYYY-MM-DD string, handy as a same-day comparison key. */
function chicagoDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHICAGO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Date key for the current 9am-9am cycle: shifting the instant back by the
 * cycle's start hour before reading the calendar date means anything before
 * 9am still keys to "yesterday", and anything at/after 9am keys to "today" —
 * exactly the boundary the sync itself runs on.
 */
export function cycleDateKey(date: Date): string {
  const shifted = new Date(date.getTime() - CYCLE_START_HOUR * 60 * 60 * 1000);
  return chicagoDateKey(shifted);
}

export function isToday(iso: string, now: Date = new Date()): boolean {
  return cycleDateKey(new Date(iso)) === cycleDateKey(now);
}

/**
 * Whether an event's start time is still ahead of `now`. Distinct from
 * isToday's cycle check on purpose: getUpcomingEvents' query has a 26-hour
 * lookback so a show that's already started stays visible under "Tonight"
 * (isToday's own docstring covers why) — but that same lookback also leaves
 * *yesterday's* leftover shows sitting in the fetched result set. isToday
 * correctly says those aren't today, but says nothing about whether they're
 * upcoming — so a "This Week" filter built on isToday alone let a show from
 * the night before leak in wearing a date already in the past. This is the
 * check that catches it. Never applied to "Tonight" — a show that already
 * started staying visible there is deliberate, not a bug.
 */
export function isUpcoming(iso: string, now: Date = new Date()): boolean {
  return new Date(iso).getTime() > now.getTime();
}

export function formatEventTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CHICAGO_TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatEventDayLabel(iso: string, now: Date = new Date()): string {
  // "Tonight"/"Tomorrow" use the same 9am-cycle boundary as isToday, so a
  // card's label never contradicts which toggle it shows up under.
  const eventKey = cycleDateKey(new Date(iso));
  const todayKey = cycleDateKey(now);
  if (eventKey === todayKey) return "Tonight";

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (eventKey === cycleDateKey(tomorrow)) return "Tomorrow";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: CHICAGO_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

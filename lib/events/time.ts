/** Austin-local time formatting helpers, shared by server and client components. */

const CHICAGO_TZ = "America/Chicago";

/** en-CA gives a plain YYYY-MM-DD string, handy as a same-day comparison key. */
function chicagoDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHICAGO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isToday(iso: string, now: Date = new Date()): boolean {
  return chicagoDateKey(new Date(iso)) === chicagoDateKey(now);
}

export function formatEventTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CHICAGO_TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatEventDayLabel(iso: string, now: Date = new Date()): string {
  const eventKey = chicagoDateKey(new Date(iso));
  const todayKey = chicagoDateKey(now);
  if (eventKey === todayKey) return "Tonight";

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (eventKey === chicagoDateKey(tomorrow)) return "Tomorrow";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: CHICAGO_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

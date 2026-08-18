/**
 * Ticketmaster Discovery API client — the second provider feeding
 * `live_events`, alongside Do512 (lib/events/do512.ts). Server-only; the key
 * is read from `TICKETMASTER_API_KEY` (no `NEXT_PUBLIC_` prefix), so it's
 * never inlined into a client bundle.
 *
 * Mirrors do512.ts's shape deliberately: a scrape/fetch function returning a
 * discriminated result that never throws, and a pure mapping function that
 * normalizes one raw event into the same provider-agnostic `LiveEventInsert`
 * shape Do512 already produces. That shared row shape — not a shared class
 * hierarchy or plugin interface — is the actual "provider architecture":
 * lib/events/sync.ts's match/upsert/deactivate pipeline (`upsertProviderRows`)
 * only ever sees `LiveEventInsert[]`, never anything Ticketmaster- or
 * Do512-specific. A future Eventbrite provider is a third file following the
 * same two-function shape, not a change to sync.ts's core pipeline.
 */

import {
  MAX_EVENT_DAYS_AHEAD,
  realValueOrNull,
  httpUrlOrNull,
  type LiveEventInsert,
} from "../do512";

const ENDPOINT = "https://app.ticketmaster.com/discovery/v2/events.json";
// This route runs on the same Vercel Hobby function budget as the Do512
// sync (see app/api/cron/sync-ticketmaster/route.ts's maxDuration) even
// though it's triggered externally, not by Vercel's own cron — the 60s hard
// kill applies regardless of caller. Pages fetch sequentially (each one
// needs the previous page's totalPages to know whether to continue), so the
// mathematical worst case is TIMEOUT_MS × MAX_PAGES, plus whatever the
// matching/upsert/deactivate DB round trips cost on top. 10s × 4 = 40s
// leaves real margin for that. Unlike do512.ts's tuned numbers, this hasn't
// been measured against the real API yet — no key was available while
// building this — so treat it as a conservative starting point, not a
// proven one, and revisit once real timings are known.
const TIMEOUT_MS = 10_000;

/** Austin only — matches the rest of the app's scope. Not user-configurable. */
const CITY = "Austin";
const STATE_CODE = "TX";

/** Ticketmaster's own page size cap is 200. */
const PAGE_SIZE = 200;
/**
 * Hard ceiling on how many pages one sync fetches, independent of how many
 * pages Ticketmaster reports exist. Austin music events within the
 * MAX_EVENT_DAYS_AHEAD window are realistically a few hundred at most, well
 * under one page — this exists purely so a change on Ticketmaster's end (or
 * a bug in our filters) can't turn one sync into an unbounded, rate-limit-
 * burning loop, and so the worst-case timeout math above stays bounded.
 */
const MAX_PAGES = 4;

export type TicketmasterResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

// ── Raw API response shapes (only the fields this app reads) ───────────────

type TmImage = { url: string; width: number; ratio?: string };
type TmClassification = { genre?: { name?: string } };
type TmVenue = {
  name?: string;
  address?: { line1?: string };
  city?: { name?: string };
  state?: { stateCode?: string };
  postalCode?: string;
  location?: { latitude?: string; longitude?: string };
};
type TmAttraction = { name?: string };

export type RawTicketmasterEvent = {
  id: string;
  name?: string;
  url?: string;
  dates?: { start?: { dateTime?: string } };
  images?: TmImage[];
  classifications?: TmClassification[];
  _embedded?: {
    venues?: TmVenue[];
    attractions?: TmAttraction[];
  };
};

type TmEventsResponse = {
  _embedded?: { events?: RawTicketmasterEvent[] };
  page?: { totalPages?: number };
  fault?: { faultstring?: string };
};

/**
 * Fetches every upcoming Austin music event from Ticketmaster, paginating
 * until Ticketmaster reports no more pages or MAX_PAGES is hit.
 *
 * Never throws: every failure path (missing key, network, timeout, non-200,
 * an API-reported fault, an unparseable body) comes back as `{ ok: false }`
 * so the sync job can report a clean failure rather than crash.
 */
export async function fetchTicketmasterEvents(
  now: Date = new Date(),
): Promise<TicketmasterResult<RawTicketmasterEvent[]>> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) return { ok: false, reason: "TICKETMASTER_API_KEY is not set" };

  const startDateTime = formatTmDateTime(now);
  const endDateTime = formatTmDateTime(
    new Date(now.getTime() + MAX_EVENT_DAYS_AHEAD * 24 * 60 * 60 * 1000),
  );

  const events: RawTicketmasterEvent[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(ENDPOINT);
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("city", CITY);
    url.searchParams.set("stateCode", STATE_CODE);
    url.searchParams.set("countryCode", "US");
    url.searchParams.set("classificationName", "music");
    url.searchParams.set("startDateTime", startDateTime);
    url.searchParams.set("endDateTime", endDateTime);
    url.searchParams.set("size", String(PAGE_SIZE));
    url.searchParams.set("page", String(page));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let body: TmEventsResponse;
    try {
      const response = await fetch(url.toString(), { signal: controller.signal });
      body = (await response.json()) as TmEventsResponse;

      if (!response.ok) {
        // Ticketmaster's error shape (confirmed against their docs):
        // { fault: { faultstring: "Invalid ApiKey" } }. Surface it when
        // present; fall back to the bare status otherwise.
        const reason = body?.fault?.faultstring ?? `Ticketmaster returned ${response.status}`;
        return { ok: false, reason };
      }
    } catch (err) {
      const reason =
        err instanceof Error && err.name === "AbortError"
          ? "Ticketmaster timed out"
          : "Could not reach Ticketmaster";
      return { ok: false, reason };
    } finally {
      clearTimeout(timer);
    }

    const pageEvents = body._embedded?.events ?? [];
    events.push(...pageEvents);

    const totalPages = body.page?.totalPages ?? 0;
    if (page + 1 >= totalPages) break;
  }

  return { ok: true, data: events };
}

/** Ticketmaster wants "YYYY-MM-DDTHH:mm:ssZ" — no milliseconds. */
function formatTmDateTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ── Pure mapping (no fetch — unit-testable) ─────────────────────────────────

/**
 * Deterministic dedupe key for a Ticketmaster event. Unlike Do512,
 * Ticketmaster gives every event a real, stable id — no hashing needed — but
 * it's still prefixed with the source, so a Ticketmaster id can never
 * collide with a Do512 source_event_id (a sha1 hex hash) even in principle,
 * and the prefix makes the source obvious when reading the table directly.
 */
export function buildTicketmasterSourceEventId(tmEventId: string): string {
  return `ticketmaster:${tmEventId}`;
}

/**
 * Best single image for the card: prefers a 16:9 image (matches the card's
 * image band aspect), then falls back to the widest image of any ratio, then
 * to nothing rather than guessing.
 */
function pickImageUrl(images: TmImage[] | undefined): string | null {
  if (!images?.length) return null;
  const widest169 = images
    .filter((img) => img.ratio === "16_9")
    .sort((a, b) => b.width - a.width)[0];
  const widestAny = images.slice().sort((a, b) => b.width - a.width)[0];
  return httpUrlOrNull((widest169 ?? widestAny)?.url);
}

function parseCoordinate(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatVenueAddress(venue: TmVenue | undefined): string | null {
  if (!venue) return null;
  const parts = [
    venue.address?.line1,
    venue.city?.name,
    venue.state?.stateCode,
    venue.postalCode,
  ].filter((part): part is string => Boolean(part?.trim()));
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Maps one raw Ticketmaster event to a `live_events` row — the same
 * provider-agnostic shape do512.ts's mapEventToRow produces. Returns null
 * when the event can't be scheduled or named, exactly like the Do512
 * mapper, so the caller skips it rather than inserting a broken row.
 */
export function mapTicketmasterEventToRow(
  event: RawTicketmasterEvent,
  now: Date = new Date(),
): LiveEventInsert | null {
  const dateTime = event.dates?.start?.dateTime;
  if (!dateTime) return null; // "time TBD" events aren't schedulable

  const eventDatetime = new Date(dateTime);
  if (Number.isNaN(eventDatetime.getTime())) return null;

  const venue = event._embedded?.venues?.[0];
  const attraction = event._embedded?.attractions?.[0];

  // Prefer the actual performer's name; Ticketmaster's own event title is
  // often a tour/promoter name ("Live Nation Presents...") rather than the
  // artist, but is the only option for events with no linked attraction.
  const artistName = realValueOrNull(attraction?.name) ?? realValueOrNull(event.name);
  const venueName = realValueOrNull(venue?.name);
  if (!artistName || !venueName) return null;

  const daysAhead = (eventDatetime.getTime() - now.getTime()) / 86_400_000;
  if (daysAhead > MAX_EVENT_DAYS_AHEAD) return null;

  return {
    source: "ticketmaster",
    source_event_id: buildTicketmasterSourceEventId(event.id),
    artist_name: artistName,
    venue_name: venueName,
    venue_address: formatVenueAddress(venue),
    event_datetime: eventDatetime.toISOString(),
    // Ticketmaster's Discovery API has no reliable "this is free" signal on
    // the base event object — guessing from absence of a price range would
    // be exactly the kind of unvalidated assumption CLAUDE.md warns against.
    // Left unknown rather than guessed.
    is_free: null,
    image_url: pickImageUrl(event.images),
    ticket_url: httpUrlOrNull(event.url),
    genre: realValueOrNull(event.classifications?.[0]?.genre?.name),
    raw_payload: event,
    last_synced_at: now.toISOString(),
  };
}


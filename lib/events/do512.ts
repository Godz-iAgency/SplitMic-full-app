/**
 * Thin Firecrawl client for scraping Do512's Austin live-music listings.
 * Server-only — import from server code only. The key is read from
 * `FIRECRAWL_API_KEY` (no `NEXT_PUBLIC_` prefix), so Next never inlines it
 * into a client bundle.
 *
 * Why Do512 and not Bandsintown: Bandsintown's self-serve API only answers
 * "what shows does artist X have," not "what's happening in Austin tonight" —
 * it can't drive a citywide feed. Do512 runs an actual, dedicated Austin
 * live-music-today page, which is the shape of data this feature needs.
 *
 * Deliberately plain `fetch` against Firecrawl's REST API instead of a
 * client library, same reasoning as lib/ai/gemini.ts: one call in, one JSON
 * object out, not worth a dependency.
 */

import { createHash } from "node:crypto";

const ENDPOINT = "https://api.firecrawl.dev/v1/scrape";

const TIMEOUT_MS = 20_000;

export const DO512_TODAY_URL = "https://do512.com/events/live-music/today";
/**
 * Do512's own /this-week path returns a 500 — it was used here originally and
 * silently poisoned the feed (see the statusCode guard in scrapeDo512Events).
 * /weekend is the working multi-day listing.
 */
export const DO512_WEEK_URL = "https://do512.com/events/live-music/weekend";

/**
 * How far ahead a scraped event may plausibly sit. A "today"/"this weekend"
 * listing can't legitimately contain a show months out, so anything past this
 * is a sign the extraction invented it rather than read it.
 */
export const MAX_EVENT_DAYS_AHEAD = 60;

/** Subset of JSON Schema that Firecrawl's jsonOptions.schema accepts. */
const EVENT_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          artist_name: { type: "string" },
          venue_name: { type: "string" },
          venue_address: { type: "string" },
          event_date: {
            type: "string",
            description: "The event's calendar date, normalized to YYYY-MM-DD.",
          },
          event_time: {
            type: "string",
            description:
              "The event's local start time, normalized to 24-hour HH:MM (e.g. 20:00 for 8pm). Omit if no time is shown.",
          },
          image_url: { type: "string" },
          ticket_url: { type: "string" },
          is_free: { type: "boolean" },
        },
        required: ["artist_name", "venue_name"],
      },
    },
  },
  required: ["events"],
};

const EXTRACT_PROMPT =
  "Extract every live music event listed on this page. For each event, get " +
  "the performing artist/band name, venue name, venue street address if " +
  "shown, the event date (normalized to YYYY-MM-DD), the event start time " +
  "(normalized to 24-hour HH:MM), a poster/artist image URL if present, a " +
  "ticket or event detail URL if present, and whether the event is " +
  "explicitly marked as free. Skip anything that is not a live music " +
  "performance (e.g. DJ nights with no listed act, comedy, non-music " +
  "events) only if it is clearly not music-related.";

export type RawDo512Event = {
  artist_name: string;
  venue_name: string;
  venue_address?: string;
  event_date?: string;
  event_time?: string;
  image_url?: string;
  ticket_url?: string;
  is_free?: boolean;
};

export type Do512Result<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

/**
 * Scrapes one Do512 listing page and returns the extracted events.
 *
 * Never throws: every failure path (missing key, network, timeout, non-200,
 * unparseable body) comes back as `{ ok: false }` so the sync job can skip
 * this page and keep going rather than crash the whole run.
 */
export async function scrapeDo512Events(
  url: string,
): Promise<Do512Result<RawDo512Event[]>> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return { ok: false, reason: "FIRECRAWL_API_KEY is not set" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        url,
        onlyMainContent: true,
        // Force a live fetch. Firecrawl caches scrapes by URL, and this URL is
        // literally "…/today" — its content changes daily while the URL never
        // does, so a cache hit silently re-serves yesterday's listings. That
        // happened in production: the 9am sync ingested the prior evening's
        // cached page, every event was already in the past, and the feed wrote
        // zero rows while reporting a clean, successful scrape.
        maxAge: 0,
        formats: ["json"],
        jsonOptions: {
          prompt: EXTRACT_PROMPT,
          schema: EVENT_SCHEMA,
        },
      }),
    });

    if (!response.ok) {
      return { ok: false, reason: `Firecrawl returned ${response.status}` };
    }

    const body = await response.json();

    // Firecrawl happily scrapes an error page and hands the HTML to an LLM,
    // which then invents plausible-looking concerts to satisfy the schema —
    // observed live: Do512's /this-week started 500ing and the extraction
    // returned Taylor Swift at MetLife Stadium with 2023 dates. The scraped
    // page's own status is the only reliable signal that happened, so treat
    // anything non-2xx as a failed scrape no matter how good the JSON looks.
    const pageStatus: unknown = body?.data?.metadata?.statusCode;
    if (typeof pageStatus === "number" && (pageStatus < 200 || pageStatus >= 300)) {
      return { ok: false, reason: `Do512 page returned ${pageStatus}` };
    }

    const events: unknown = body?.data?.json?.events;
    if (!Array.isArray(events)) {
      return { ok: false, reason: "Firecrawl returned no events array" };
    }

    return { ok: true, data: events as RawDo512Event[] };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? "Firecrawl timed out"
        : "Could not reach Firecrawl";
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

// ── Pure mapping helpers (no fetch — unit-testable) ─────────────────────────

/** Row shape accepted by the `live_events` upsert. */
export type LiveEventInsert = {
  source: "do512";
  source_event_id: string;
  artist_name: string;
  venue_name: string;
  venue_address: string | null;
  event_datetime: string; // ISO, UTC
  is_free: boolean | null;
  image_url: string | null;
  ticket_url: string | null;
  raw_payload: RawDo512Event;
  last_synced_at: string;
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Chicago's UTC offset (minutes, negative) on a given calendar date, DST-aware. */
function chicagoOffsetMinutesFor(year: number, month: number, day: number): number {
  // Noon UTC is never near a DST transition boundary for any real date, so
  // it's a safe reference instant for reading Chicago's local hour off it.
  const reference = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    hour12: false,
  })
    .formatToParts(reference)
    .find((part) => part.type === "hour")?.value;
  const chicagoHour = hourPart ? Number(hourPart) : 12;
  return (chicagoHour - 12) * 60;
}

/**
 * Converts a Do512 "YYYY-MM-DD" + "HH:MM" wall-clock pair (Austin/Chicago
 * local time) into a UTC ISO timestamp. Returns null if either string isn't
 * in the expected normalized shape.
 */
export function chicagoWallTimeToUtcIso(
  dateStr: string,
  timeStr: string,
): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour > 23 || minute > 59) return null;

  const offsetMinutes = chicagoOffsetMinutesFor(year, month, day);
  const utcMs =
    Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMinutes * 60_000;
  return new Date(utcMs).toISOString();
}

/**
 * Deterministic dedupe key for an event. Do512 doesn't expose a stable
 * per-event id, so this derives one from the (venue, artist, time) triple —
 * stable across re-scrapes of the same show, distinct for different shows at
 * the same venue on the same night.
 */
export function buildSourceEventId(
  venueName: string,
  artistName: string,
  eventDatetimeIso: string,
): string {
  const key = `${normalize(venueName)}|${normalize(artistName)}|${eventDatetimeIso}`;
  return createHash("sha1").update(key).digest("hex");
}

/**
 * Maps one raw scraped event to a `live_events` row. Returns null when the
 * event can't be scheduled (no parseable date/time) — those get skipped by
 * the caller rather than inserted with a fabricated time.
 *
 * Also rejects implausibly distant dates. This is the second half of the
 * anti-hallucination guard: the statusCode check in scrapeDo512Events catches
 * an outright broken page, and this catches invented rows that slip through a
 * page that technically returned 200.
 */
export function mapEventToRow(
  event: RawDo512Event,
  now: Date = new Date(),
): LiveEventInsert | null {
  if (!event.event_date || !event.event_time) return null;

  // artist_name and venue_name are the schema's only required fields, so the
  // extraction fills them with a placeholder rather than omitting them when
  // it has nothing. A row named "N/A" has nothing renderable in it — skip it
  // instead of storing a card with a placeholder for a title.
  const artistName = realValueOrNull(event.artist_name);
  const venueName = realValueOrNull(event.venue_name);
  if (!artistName || !venueName) return null;

  const eventDatetime = chicagoWallTimeToUtcIso(event.event_date, event.event_time);
  if (!eventDatetime) return null;

  const daysAhead =
    (new Date(eventDatetime).getTime() - now.getTime()) / 86_400_000;
  if (daysAhead > MAX_EVENT_DAYS_AHEAD) return null;

  return {
    source: "do512",
    // Hash-stable against the pre-trim call this replaced: buildSourceEventId
    // normalizes (trim + lowercase) internally, so already-trimmed input
    // yields the same id and existing rows still dedupe rather than doubling.
    source_event_id: buildSourceEventId(venueName, artistName, eventDatetime),
    artist_name: artistName,
    venue_name: venueName,
    venue_address: realValueOrNull(event.venue_address),
    event_datetime: eventDatetime,
    is_free: typeof event.is_free === "boolean" ? event.is_free : null,
    image_url: httpUrlOrNull(event.image_url),
    ticket_url: httpUrlOrNull(event.ticket_url),
    raw_payload: event,
    last_synced_at: now.toISOString(),
  };
}

/**
 * Validates against reality, not just the schema: the extraction schema
 * types image_url/ticket_url as plain strings with no format constraint, and
 * observed live, Firecrawl fills the gap with the literal word "Unknown"
 * rather than omitting the field when a page has no image — which then
 * rendered as an <img src="…/Unknown"> resolved against our own origin.
 * Schema-shaped output is not evidence a URL was actually present.
 */
/**
 * Values an LLM extraction emits to satisfy a field it has no data for.
 * Matched as whole strings after trim + lowercase, never as substrings, so a
 * real value containing one of these words ("Nada Surf", "The Unknown") is
 * untouched.
 */
const PLACEHOLDER_VALUES = new Set([
  "n/a",
  "na",
  "n.a.",
  "unknown",
  "none",
  "null",
  "undefined",
  "tbd",
  "tba",
  "not available",
  "not specified",
  "not listed",
  "no address",
  "-",
  "--",
  "?",
]);

/**
 * The non-URL counterpart to httpUrlOrNull, and the same lesson: the schema
 * types venue_address as a plain string, so "no address on this listing" came
 * back as the literal string "N/A" rather than an omitted field — observed
 * live on 5 of 32 active rows. Nothing downstream could tell it from a real
 * address, so it was passed to Google Maps and Uber as a destination and
 * published as the venue's `address` in the page's MusicEvent structured
 * data. Nulling it here lets all three fall back to "<venue name>, Austin,
 * TX", which is what they already do when the field is genuinely absent.
 */
function realValueOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return PLACEHOLDER_VALUES.has(trimmed.toLowerCase()) ? null : trimmed;
}

function httpUrlOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

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
export const DO512_WEEK_URL = "https://do512.com/events/live-music/this-week";

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
        formats: [
          {
            type: "json",
            prompt: EXTRACT_PROMPT,
            schema: EVENT_SCHEMA,
          },
        ],
      }),
    });

    if (!response.ok) {
      return { ok: false, reason: `Firecrawl returned ${response.status}` };
    }

    const body = await response.json();
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
 */
export function mapEventToRow(
  event: RawDo512Event,
  now: Date = new Date(),
): LiveEventInsert | null {
  if (!event.event_date || !event.event_time) return null;

  const eventDatetime = chicagoWallTimeToUtcIso(event.event_date, event.event_time);
  if (!eventDatetime) return null;

  return {
    source: "do512",
    source_event_id: buildSourceEventId(
      event.venue_name,
      event.artist_name,
      eventDatetime,
    ),
    artist_name: event.artist_name.trim(),
    venue_name: event.venue_name.trim(),
    venue_address: event.venue_address?.trim() || null,
    event_datetime: eventDatetime,
    is_free: typeof event.is_free === "boolean" ? event.is_free : null,
    image_url: event.image_url?.trim() || null,
    ticket_url: event.ticket_url?.trim() || null,
    raw_payload: event,
    last_synced_at: now.toISOString(),
  };
}

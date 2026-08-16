import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  scrapeDo512Events,
  chicagoWallTimeToUtcIso,
  buildSourceEventId,
  mapEventToRow,
  type RawDo512Event,
} from "./do512";

describe("chicagoWallTimeToUtcIso", () => {
  it("converts CDT (daylight time) wall clock to the correct UTC instant", () => {
    // Austin is UTC-5 in August (CDT).
    expect(chicagoWallTimeToUtcIso("2026-08-15", "20:00")).toBe(
      "2026-08-16T01:00:00.000Z",
    );
  });

  it("converts CST (standard time) wall clock to the correct UTC instant", () => {
    // Austin is UTC-6 in January (CST).
    expect(chicagoWallTimeToUtcIso("2026-01-15", "20:00")).toBe(
      "2026-01-16T02:00:00.000Z",
    );
  });

  it("returns null for a malformed date", () => {
    expect(chicagoWallTimeToUtcIso("Aug 15", "20:00")).toBeNull();
  });

  it("returns null for a malformed time", () => {
    expect(chicagoWallTimeToUtcIso("2026-08-15", "8pm")).toBeNull();
  });

  it("returns null for an out-of-range hour or minute", () => {
    expect(chicagoWallTimeToUtcIso("2026-08-15", "25:00")).toBeNull();
    expect(chicagoWallTimeToUtcIso("2026-08-15", "20:75")).toBeNull();
  });
});

describe("buildSourceEventId", () => {
  it("is stable for the same show across re-scrapes", () => {
    const a = buildSourceEventId("Mohawk Austin", "Test Band", "2026-08-16T01:00:00.000Z");
    const b = buildSourceEventId("mohawk austin", "  Test Band  ", "2026-08-16T01:00:00.000Z");
    expect(a).toBe(b);
  });

  it("differs for a different show", () => {
    const a = buildSourceEventId("Mohawk Austin", "Test Band", "2026-08-16T01:00:00.000Z");
    const b = buildSourceEventId("Mohawk Austin", "Other Band", "2026-08-16T01:00:00.000Z");
    expect(a).not.toBe(b);
  });
});

describe("mapEventToRow", () => {
  const NOW = new Date("2026-08-15T12:00:00Z");

  it("maps a well-formed event", () => {
    const raw: RawDo512Event = {
      artist_name: "Test Band",
      venue_name: "Mohawk Austin",
      venue_address: "912 Red River St, Austin, TX",
      event_date: "2026-08-15",
      event_time: "20:00",
      image_url: "https://example.com/img.jpg",
      ticket_url: "https://example.com/tickets",
      is_free: false,
    };

    const row = mapEventToRow(raw, NOW);

    expect(row).toMatchObject({
      source: "do512",
      artist_name: "Test Band",
      venue_name: "Mohawk Austin",
      venue_address: "912 Red River St, Austin, TX",
      event_datetime: "2026-08-16T01:00:00.000Z",
      is_free: false,
      image_url: "https://example.com/img.jpg",
      ticket_url: "https://example.com/tickets",
    });
    expect(row?.source_event_id).toBeTruthy();
  });

  it("returns null when the date is missing", () => {
    const raw: RawDo512Event = { artist_name: "A", venue_name: "B", event_time: "20:00" };
    expect(mapEventToRow(raw, NOW)).toBeNull();
  });

  it("returns null when the time is missing", () => {
    const raw: RawDo512Event = { artist_name: "A", venue_name: "B", event_date: "2026-08-15" };
    expect(mapEventToRow(raw, NOW)).toBeNull();
  });

  it("returns null when the date/time can't be parsed", () => {
    const raw: RawDo512Event = {
      artist_name: "A",
      venue_name: "B",
      event_date: "not a date",
      event_time: "20:00",
    };
    expect(mapEventToRow(raw, NOW)).toBeNull();
  });

  it("defaults optional fields to null rather than undefined", () => {
    const raw: RawDo512Event = {
      artist_name: "A",
      venue_name: "B",
      event_date: "2026-08-15",
      event_time: "20:00",
    };
    const row = mapEventToRow(raw, NOW);
    expect(row?.venue_address).toBeNull();
    expect(row?.is_free).toBeNull();
    expect(row?.image_url).toBeNull();
    expect(row?.ticket_url).toBeNull();
  });

  it("rejects an implausibly distant date as invented", () => {
    // A "today"/"this weekend" listing can't hold a show a year out. This is
    // the shape hallucinated rows took when the source page was broken.
    const raw: RawDo512Event = {
      artist_name: "Taylor Swift",
      venue_name: "MetLife Stadium",
      event_date: "2027-09-23",
      event_time: "20:00",
    };
    expect(mapEventToRow(raw, NOW)).toBeNull();
  });

  it("still accepts a date inside the plausible window", () => {
    const raw: RawDo512Event = {
      artist_name: "A",
      venue_name: "B",
      event_date: "2026-09-01",
      event_time: "20:00",
    };
    expect(mapEventToRow(raw, NOW)).not.toBeNull();
  });

  describe("image_url / ticket_url validation", () => {
    // Regression guard for a real incident: Firecrawl's extraction filled a
    // missing image with the literal string "Unknown" instead of omitting
    // the field, which then rendered live as <img src="…/Unknown"> resolved
    // against our own origin. The schema types these as plain strings with
    // no format constraint, so nothing else catches this.
    it('rejects the literal string "Unknown" as an image_url', () => {
      const raw: RawDo512Event = {
        artist_name: "A",
        venue_name: "B",
        event_date: "2026-08-15",
        event_time: "20:00",
        image_url: "Unknown",
      };
      expect(mapEventToRow(raw, NOW)?.image_url).toBeNull();
    });

    it("rejects non-URL junk in ticket_url the same way", () => {
      const raw: RawDo512Event = {
        artist_name: "A",
        venue_name: "B",
        event_date: "2026-08-15",
        event_time: "20:00",
        ticket_url: "N/A",
      };
      expect(mapEventToRow(raw, NOW)?.ticket_url).toBeNull();
    });

    it("keeps a real http(s) image_url", () => {
      const raw: RawDo512Event = {
        artist_name: "A",
        venue_name: "B",
        event_date: "2026-08-15",
        event_time: "20:00",
        image_url: "https://example.com/poster.jpg",
      };
      expect(mapEventToRow(raw, NOW)?.image_url).toBe("https://example.com/poster.jpg");
    });

    it("rejects a non-http(s) scheme", () => {
      const raw: RawDo512Event = {
        artist_name: "A",
        venue_name: "B",
        event_date: "2026-08-15",
        event_time: "20:00",
        image_url: "javascript:alert(1)",
      };
      expect(mapEventToRow(raw, NOW)?.image_url).toBeNull();
    });
  });

  describe("placeholder values in text fields", () => {
    // Regression guard for a real incident, and the non-URL sibling of the
    // "Unknown" image_url bug above: the extraction returned the literal
    // string "N/A" for venue_address on 5 of 32 live rows rather than
    // omitting the field. Being truthy, it survived every `||` fallback and
    // was handed to Google Maps and Uber as a destination, and published as
    // the venue's address in the page's MusicEvent JSON-LD.
    it('nulls a literal "N/A" venue_address so the venue-name fallback applies', () => {
      const raw: RawDo512Event = {
        artist_name: "A",
        venue_name: "B",
        event_date: "2026-08-15",
        event_time: "20:00",
        venue_address: "N/A",
      };
      expect(mapEventToRow(raw, NOW)?.venue_address).toBeNull();
    });

    it("nulls other placeholder spellings case-insensitively", () => {
      for (const placeholder of ["n/a", " Unknown ", "TBD", "none", "-"]) {
        const raw: RawDo512Event = {
          artist_name: "A",
          venue_name: "B",
          event_date: "2026-08-15",
          event_time: "20:00",
          venue_address: placeholder,
        };
        expect(mapEventToRow(raw, NOW)?.venue_address).toBeNull();
      }
    });

    it("keeps a real address untouched", () => {
      const raw: RawDo512Event = {
        artist_name: "A",
        venue_name: "B",
        event_date: "2026-08-15",
        event_time: "20:00",
        venue_address: "912 Red River, Austin, TX, 78701",
      };
      expect(mapEventToRow(raw, NOW)?.venue_address).toBe(
        "912 Red River, Austin, TX, 78701",
      );
    });

    it("matches whole strings only, never substrings", () => {
      // "Nada Surf" starts with "na"; "The Unknown" contains "unknown". A
      // substring check would silently delete both.
      const raw: RawDo512Event = {
        artist_name: "Nada Surf",
        venue_name: "The Unknown",
        event_date: "2026-08-15",
        event_time: "20:00",
        venue_address: "1 Unknown Road, Austin, TX",
      };
      const row = mapEventToRow(raw, NOW);
      expect(row?.artist_name).toBe("Nada Surf");
      expect(row?.venue_name).toBe("The Unknown");
      expect(row?.venue_address).toBe("1 Unknown Road, Austin, TX");
    });

    it("skips the row entirely when a required name is a placeholder", () => {
      // Unlike an address, there's no sensible fallback for these — a card
      // titled "N/A" is worthless, so the row shouldn't exist at all.
      const noArtist: RawDo512Event = {
        artist_name: "N/A",
        venue_name: "B",
        event_date: "2026-08-15",
        event_time: "20:00",
      };
      const noVenue: RawDo512Event = {
        artist_name: "A",
        venue_name: "Unknown",
        event_date: "2026-08-15",
        event_time: "20:00",
      };
      expect(mapEventToRow(noArtist, NOW)).toBeNull();
      expect(mapEventToRow(noVenue, NOW)).toBeNull();
    });

    it("keeps source_event_id stable against the pre-trim implementation", () => {
      // mapEventToRow now passes already-trimmed names to buildSourceEventId
      // instead of the raw ones. buildSourceEventId normalizes internally, so
      // the id must be unchanged — otherwise every existing row would fail to
      // dedupe on the next sync and silently double.
      const raw: RawDo512Event = {
        artist_name: "  Test Band  ",
        venue_name: "  Mohawk Austin  ",
        event_date: "2026-08-15",
        event_time: "20:00",
      };
      expect(mapEventToRow(raw, NOW)?.source_event_id).toBe(
        buildSourceEventId("Mohawk Austin", "Test Band", "2026-08-16T01:00:00.000Z"),
      );
    });
  });
});

describe("scrapeDo512Events", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.FIRECRAWL_API_KEY;

  beforeEach(() => {
    process.env.FIRECRAWL_API_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.FIRECRAWL_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("fails without throwing when the API key is missing", async () => {
    delete process.env.FIRECRAWL_API_KEY;
    const result = await scrapeDo512Events("https://do512.com/events/live-music/today");
    expect(result).toEqual({ ok: false, reason: "FIRECRAWL_API_KEY is not set" });
  });

  it("returns the extracted events on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { json: { events: [{ artist_name: "A", venue_name: "B" }] } } }),
    }) as unknown as typeof fetch;

    const result = await scrapeDo512Events("https://do512.com/events/live-music/today");

    expect(result).toEqual({ ok: true, data: [{ artist_name: "A", venue_name: "B" }] });
  });

  it("asks Firecrawl for a live fetch instead of a cached copy", async () => {
    // Regression guard for a full day of silent breakage: Firecrawl caches by
    // URL, and this URL is ".../today" — content changes daily, URL never
    // does. A cache hit re-served the previous evening's listings, so the 9am
    // sync ingested only events that had already happened and wrote nothing,
    // while still reporting a successful scrape.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { json: { events: [] } } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await scrapeDo512Events("https://do512.com/events/live-music/today");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.maxAge).toBe(0);
  });

  it("rejects events extracted from a page that itself errored", async () => {
    // Regression guard for a real incident: Do512's /this-week began
    // returning 500, Firecrawl scraped the error page anyway, and the LLM
    // invented well-formed concerts (Taylor Swift at MetLife, 2023 dates) to
    // fill the schema. Firecrawl's own call succeeds here — only the scraped
    // page's status reveals the content is worthless.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          metadata: { statusCode: 500 },
          json: {
            events: [
              { artist_name: "Taylor Swift", venue_name: "MetLife Stadium" },
            ],
          },
        },
      }),
    }) as unknown as typeof fetch;

    const result = await scrapeDo512Events("https://do512.com/events/live-music/this-week");

    expect(result).toEqual({ ok: false, reason: "Do512 page returned 500" });
  });

  it("still accepts events when the scraped page returned 200", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          metadata: { statusCode: 200 },
          json: { events: [{ artist_name: "A", venue_name: "B" }] },
        },
      }),
    }) as unknown as typeof fetch;

    const result = await scrapeDo512Events("https://do512.com/events/live-music/today");

    expect(result.ok).toBe(true);
  });

  it("fails without throwing on a non-200 response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    const result = await scrapeDo512Events("https://do512.com/events/live-music/today");

    expect(result).toEqual({ ok: false, reason: "Firecrawl returned 500" });
  });

  it("fails without throwing when the response has no events array", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { json: {} } }),
    }) as unknown as typeof fetch;

    const result = await scrapeDo512Events("https://do512.com/events/live-music/today");

    expect(result.ok).toBe(false);
  });

  it("fails without throwing on a network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const result = await scrapeDo512Events("https://do512.com/events/live-music/today");

    expect(result).toEqual({ ok: false, reason: "Could not reach Firecrawl" });
  });
});

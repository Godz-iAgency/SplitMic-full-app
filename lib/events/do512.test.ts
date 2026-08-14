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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchTicketmasterEvents,
  mapTicketmasterEventToRow,
  buildTicketmasterSourceEventId,
  type RawTicketmasterEvent,
} from "./ticketmaster";

const NOW = new Date("2026-08-17T12:00:00Z");

function makeEvent(overrides: Partial<RawTicketmasterEvent> = {}): RawTicketmasterEvent {
  return {
    id: "vvG1zZbb2",
    name: "Gary Clark Jr.",
    url: "https://www.ticketmaster.com/event/vvG1zZbb2",
    dates: { start: { dateTime: "2026-08-20T01:00:00Z" } },
    images: [
      { url: "https://example.com/small.jpg", width: 100, ratio: "16_9" },
      { url: "https://example.com/big.jpg", width: 1000, ratio: "16_9" },
    ],
    classifications: [{ genre: { name: "Rock" } }],
    _embedded: {
      venues: [
        {
          name: "ACL Live at The Moody Theater",
          address: { line1: "310 Willie Nelson Blvd" },
          city: { name: "Austin" },
          state: { stateCode: "TX" },
          postalCode: "78701",
          location: { latitude: "30.266327", longitude: "-97.74806" },
        },
      ],
      attractions: [{ name: "Gary Clark Jr." }],
    },
    ...overrides,
  };
}

describe("buildTicketmasterSourceEventId", () => {
  it("prefixes with the source so it can never collide with a Do512 hash", () => {
    expect(buildTicketmasterSourceEventId("vvG1zZbb2")).toBe("ticketmaster:vvG1zZbb2");
  });
});

describe("mapTicketmasterEventToRow", () => {
  it("maps a well-formed event", () => {
    const row = mapTicketmasterEventToRow(makeEvent(), NOW);

    expect(row).toMatchObject({
      source: "ticketmaster",
      source_event_id: "ticketmaster:vvG1zZbb2",
      artist_name: "Gary Clark Jr.",
      venue_name: "ACL Live at The Moody Theater",
      venue_address: "310 Willie Nelson Blvd, Austin, TX, 78701",
      event_datetime: "2026-08-20T01:00:00.000Z",
      ticket_url: "https://www.ticketmaster.com/event/vvG1zZbb2",
      genre: "Rock",
      is_free: null,
    });
  });

  it("prefers the linked attraction's name over the event's own title", () => {
    const row = mapTicketmasterEventToRow(
      makeEvent({
        name: "Live Nation Presents: Summer Tour",
        _embedded: {
          venues: makeEvent()._embedded!.venues,
          attractions: [{ name: "The Real Artist" }],
        },
      }),
      NOW,
    );
    expect(row?.artist_name).toBe("The Real Artist");
  });

  it("falls back to the event's own name when no attraction is linked", () => {
    const row = mapTicketmasterEventToRow(
      makeEvent({
        name: "Emo Night Tour",
        _embedded: { venues: makeEvent()._embedded!.venues, attractions: [] },
      }),
      NOW,
    );
    expect(row?.artist_name).toBe("Emo Night Tour");
  });

  it("returns null when there's no start dateTime (time TBD)", () => {
    const row = mapTicketmasterEventToRow(
      makeEvent({ dates: { start: {} } }),
      NOW,
    );
    expect(row).toBeNull();
  });

  it("returns null when the venue name is missing", () => {
    const row = mapTicketmasterEventToRow(
      makeEvent({ _embedded: { venues: [], attractions: makeEvent()._embedded!.attractions } }),
      NOW,
    );
    expect(row).toBeNull();
  });

  it("rejects an implausibly distant date, same guard as Do512", () => {
    const row = mapTicketmasterEventToRow(
      makeEvent({ dates: { start: { dateTime: "2027-12-01T00:00:00Z" } } }),
      NOW,
    );
    expect(row).toBeNull();
  });

  it("picks the widest 16:9 image over a smaller one", () => {
    const row = mapTicketmasterEventToRow(makeEvent(), NOW);
    expect(row?.image_url).toBe("https://example.com/big.jpg");
  });

  it("falls back to the widest image of any ratio when no 16:9 is present", () => {
    const row = mapTicketmasterEventToRow(
      makeEvent({
        images: [
          { url: "https://example.com/4x3-small.jpg", width: 200, ratio: "4_3" },
          { url: "https://example.com/4x3-big.jpg", width: 800, ratio: "4_3" },
        ],
      }),
      NOW,
    );
    expect(row?.image_url).toBe("https://example.com/4x3-big.jpg");
  });

  it("returns null image_url when there are no images", () => {
    const row = mapTicketmasterEventToRow(makeEvent({ images: [] }), NOW);
    expect(row?.image_url).toBeNull();
  });

  describe("placeholder genre handling", () => {
    // Regression guard, same lesson as do512.ts's "N/A"/"Unknown" incident:
    // Ticketmaster's own sentinel for an unclassified genre is the literal
    // string "Undefined", which is truthy and would otherwise render as a
    // genre filter option named "Undefined".
    it('nulls a literal "Undefined" genre', () => {
      const row = mapTicketmasterEventToRow(
        makeEvent({ classifications: [{ genre: { name: "Undefined" } }] }),
        NOW,
      );
      expect(row?.genre).toBeNull();
    });

    it("nulls a missing classification entirely", () => {
      const row = mapTicketmasterEventToRow(makeEvent({ classifications: [] }), NOW);
      expect(row?.genre).toBeNull();
    });

    it("keeps a real genre untouched", () => {
      const row = mapTicketmasterEventToRow(
        makeEvent({ classifications: [{ genre: { name: "Country" } }] }),
        NOW,
      );
      expect(row?.genre).toBe("Country");
    });
  });

  it("omits venue_address entirely when nothing is known, rather than a string of commas", () => {
    const row = mapTicketmasterEventToRow(
      makeEvent({
        _embedded: {
          venues: [{ name: "Some Venue" }],
          attractions: makeEvent()._embedded!.attractions,
        },
      }),
      NOW,
    );
    expect(row?.venue_address).toBeNull();
  });
});

describe("fetchTicketmasterEvents", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.TICKETMASTER_API_KEY;

  beforeEach(() => {
    process.env.TICKETMASTER_API_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.TICKETMASTER_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("fails without throwing when the API key is missing", async () => {
    delete process.env.TICKETMASTER_API_KEY;
    const result = await fetchTicketmasterEvents(NOW);
    expect(result).toEqual({ ok: false, reason: "TICKETMASTER_API_KEY is not set" });
  });

  it("returns events from a single-page response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        _embedded: { events: [makeEvent()] },
        page: { totalPages: 1 },
      }),
    }) as unknown as typeof fetch;

    const result = await fetchTicketmasterEvents(NOW);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(1);
  });

  it("surfaces Ticketmaster's own fault message on a failed request", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ fault: { faultstring: "Invalid ApiKey" } }),
    }) as unknown as typeof fetch;

    const result = await fetchTicketmasterEvents(NOW);

    expect(result).toEqual({ ok: false, reason: "Invalid ApiKey" });
  });

  it("fails without throwing on a network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const result = await fetchTicketmasterEvents(NOW);

    expect(result).toEqual({ ok: false, reason: "Could not reach Ticketmaster" });
  });

  it("paginates until Ticketmaster reports no more pages", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const page = new URL(url).searchParams.get("page");
      return {
        ok: true,
        json: async () => ({
          _embedded: { events: [makeEvent({ id: `event-${page}` })] },
          page: { totalPages: 3 },
        }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchTicketmasterEvents(NOW);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(3);
  });

  it("stops at the hard page cap even if Ticketmaster reports more pages", async () => {
    // Guards against one sync turning into an unbounded, rate-limit-burning
    // loop if Ticketmaster's reported totalPages is ever wrong or huge.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        _embedded: { events: [makeEvent()] },
        page: { totalPages: 999 },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchTicketmasterEvents(NOW);

    expect(fetchMock.mock.calls.length).toBe(4);
  });

  it("scopes every request to Austin, TX music events", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ _embedded: { events: [] }, page: { totalPages: 1 } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchTicketmasterEvents(NOW);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("city")).toBe("Austin");
    expect(url.searchParams.get("stateCode")).toBe("TX");
    expect(url.searchParams.get("classificationName")).toBe("music");
  });
});

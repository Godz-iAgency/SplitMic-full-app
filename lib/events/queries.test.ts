import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUpcomingEvents } from "./queries";

type FilterCall = { method: string; args: unknown[] };

/**
 * Records every filter call so tests can assert the query's actual bounds.
 * Distinguishes the two tables getUpcomingEvents touches: `live_events`
 * (select ... order, resolved in order()) and `directory_businesses` (select
 * ... in ... eq, resolved in the trailing eq()) — the directory lookup only
 * ever runs when at least one row has a matched_directory_business_id.
 */
function fakeSupabase(
  rows: Record<string, unknown>[],
  directoryRows: Record<string, unknown>[] = [],
) {
  const calls: FilterCall[] = [];
  const directoryCalls: FilterCall[] = [];

  const liveEventsBuilder: Record<string, unknown> = {
    select: (...args: unknown[]) => {
      calls.push({ method: "select", args });
      return liveEventsBuilder;
    },
    eq: (...args: unknown[]) => {
      calls.push({ method: "eq", args });
      return liveEventsBuilder;
    },
    gte: (...args: unknown[]) => {
      calls.push({ method: "gte", args });
      return liveEventsBuilder;
    },
    lte: (...args: unknown[]) => {
      calls.push({ method: "lte", args });
      return liveEventsBuilder;
    },
    order: (...args: unknown[]) => {
      calls.push({ method: "order", args });
      return Promise.resolve({ data: rows, error: null });
    },
  };

  const directoryBuilder: Record<string, unknown> = {
    select: (...args: unknown[]) => {
      directoryCalls.push({ method: "select", args });
      return directoryBuilder;
    },
    in: (...args: unknown[]) => {
      directoryCalls.push({ method: "in", args });
      return directoryBuilder;
    },
    eq: (...args: unknown[]) => {
      directoryCalls.push({ method: "eq", args });
      return Promise.resolve({ data: directoryRows, error: null });
    },
  };

  const client = {
    from: (table: string) =>
      table === "directory_businesses" ? directoryBuilder : liveEventsBuilder,
  } as unknown as SupabaseClient;

  return { client, calls, directoryCalls };
}

const ROW = {
  id: "1",
  artist_name: "A",
  venue_name: "B",
  venue_address: null,
  venue_latitude: null,
  venue_longitude: null,
  event_datetime: "2026-08-14T01:00:00.000Z",
  is_free: null,
  image_url: null,
  ticket_url: null,
  matched_profile_id: null,
  matched_profile_type: null,
  matched_directory_business_id: null,
};

describe("getUpcomingEvents", () => {
  it("only fetches active events", () => {
    const { client, calls } = fakeSupabase([]);
    void getUpcomingEvents(client);
    expect(calls).toContainEqual({ method: "eq", args: ["is_active", true] });
  });

  it("looks back 26 hours so a show that already started stays in the window", () => {
    const now = new Date("2026-08-13T20:00:00.000Z"); // 3pm Chicago Aug 13
    const { client, calls } = fakeSupabase([]);
    void getUpcomingEvents(client, { now });

    const gte = calls.find((c) => c.method === "gte");
    expect(gte?.args[0]).toBe("event_datetime");
    const lowerBound = new Date(gte!.args[1] as string);
    const expected = new Date(now.getTime() - 26 * 60 * 60 * 1000);
    expect(lowerBound.getTime()).toBe(expected.getTime());
  });

  it("looks ahead rangeDays (default 7)", () => {
    const now = new Date("2026-08-13T20:00:00.000Z");
    const { client, calls } = fakeSupabase([]);
    void getUpcomingEvents(client, { now });

    const lte = calls.find((c) => c.method === "lte");
    const upperBound = new Date(lte!.args[1] as string);
    const expected = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(upperBound.getTime()).toBe(expected.getTime());
  });

  it("honours a custom rangeDays", () => {
    const now = new Date("2026-08-13T20:00:00.000Z");
    const { client, calls } = fakeSupabase([]);
    void getUpcomingEvents(client, { now, rangeDays: 1 });

    const lte = calls.find((c) => c.method === "lte");
    const upperBound = new Date(lte!.args[1] as string);
    const expected = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    expect(upperBound.getTime()).toBe(expected.getTime());
  });

  it("maps rows to the card shape", async () => {
    const { client } = fakeSupabase([ROW]);
    const result = await getUpcomingEvents(client);
    expect(result).toEqual([
      {
        id: "1",
        artistName: "A",
        venueName: "B",
        venueAddress: null,
        venueLatitude: null,
        venueLongitude: null,
        eventDatetime: "2026-08-14T01:00:00.000Z",
        isFree: null,
        imageUrl: null,
        ticketUrl: null,
        matchedProfileId: null,
        matchedProfileType: null,
        directoryBusinessId: null,
        directoryPhotoUrl: null,
      },
    ]);
  });

  describe("matched directory venue", () => {
    it("skips the directory lookup entirely when nothing matched", async () => {
      const { client, directoryCalls } = fakeSupabase([ROW]);
      await getUpcomingEvents(client);
      expect(directoryCalls).toEqual([]);
    });

    it("joins the matched business's Open Graph photo", async () => {
      const row = { ...ROW, matched_directory_business_id: "biz-1" };
      const { client, directoryCalls } = fakeSupabase(
        [row],
        [{ id: "biz-1", og_image_url: "https://og.example.com/1.jpg", screenshot_url: null }],
      );

      const result = await getUpcomingEvents(client);

      expect(result[0].directoryBusinessId).toBe("biz-1");
      expect(result[0].directoryPhotoUrl).toBe("https://og.example.com/1.jpg");
      // Re-checked live, not just trusted from the sync-time snapshot.
      expect(directoryCalls).toContainEqual({ method: "eq", args: ["is_active", true] });
    });

    it("falls back to the screenshot when there's no Open Graph image", async () => {
      const row = { ...ROW, matched_directory_business_id: "biz-1" };
      const { client } = fakeSupabase(
        [row],
        [{ id: "biz-1", og_image_url: null, screenshot_url: "https://shot.example.com/1.jpg" }],
      );

      const result = await getUpcomingEvents(client);

      expect(result[0].directoryPhotoUrl).toBe("https://shot.example.com/1.jpg");
    });

    it("treats a deactivated match as no match at all", async () => {
      // The business row not coming back (filtered by is_active=true on the
      // directory side) means the id simply isn't in the response set.
      const row = { ...ROW, matched_directory_business_id: "biz-dead" };
      const { client } = fakeSupabase([row], []);

      const result = await getUpcomingEvents(client);

      expect(result[0].directoryBusinessId).toBeNull();
      expect(result[0].directoryPhotoUrl).toBeNull();
    });

    it("de-duplicates repeated business ids across multiple events into one lookup", async () => {
      const rowA = { ...ROW, id: "1", matched_directory_business_id: "biz-1" };
      const rowB = { ...ROW, id: "2", matched_directory_business_id: "biz-1" };
      const { client, directoryCalls } = fakeSupabase(
        [rowA, rowB],
        [{ id: "biz-1", og_image_url: "https://og.example.com/1.jpg", screenshot_url: null }],
      );

      const result = await getUpcomingEvents(client);

      const inCall = directoryCalls.find((c) => c.method === "in");
      expect(inCall?.args[1]).toEqual(["biz-1"]);
      expect(result.every((r) => r.directoryPhotoUrl === "https://og.example.com/1.jpg")).toBe(true);
    });
  });
});

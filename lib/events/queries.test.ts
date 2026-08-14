import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUpcomingEvents } from "./queries";

type FilterCall = { method: string; args: unknown[] };

/** Records every filter call so tests can assert the query's actual bounds. */
function fakeSupabase(rows: Record<string, unknown>[]) {
  const calls: FilterCall[] = [];

  const builder: Record<string, unknown> = {
    select: (...args: unknown[]) => {
      calls.push({ method: "select", args });
      return builder;
    },
    eq: (...args: unknown[]) => {
      calls.push({ method: "eq", args });
      return builder;
    },
    gte: (...args: unknown[]) => {
      calls.push({ method: "gte", args });
      return builder;
    },
    lte: (...args: unknown[]) => {
      calls.push({ method: "lte", args });
      return builder;
    },
    order: (...args: unknown[]) => {
      calls.push({ method: "order", args });
      return Promise.resolve({ data: rows, error: null });
    },
  };

  const client = { from: () => builder } as unknown as SupabaseClient;
  return { client, calls };
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
      },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DETAIL_SOURCE, fetchDisplayNames } from "./detailSource";
import { PLAYER_TYPE_OPTIONS } from "@/lib/types";

// Canned rows (or an error) per table. Every chain is awaitable at .in(),
// which is where fetchDisplayNames ends each query.
function fakeSupabase(
  tables: Record<string, Record<string, unknown>[] | "error">,
  queried: string[] = [],
): SupabaseClient {
  return {
    from: (table: string) => {
      queried.push(table);
      const result =
        tables[table] === "error"
          ? { data: null, error: { message: "relation does not exist" } }
          : { data: tables[table] ?? [], error: null };
      const chain = {
        select: () => chain,
        in: () => Promise.resolve(result),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe("fetchDisplayNames", () => {
  it("looks in every player type's detail table", () => {
    // The point of the shared helper: a new player type is picked up by inbox,
    // feed, admin, and email the moment it has a DETAIL_SOURCE entry.
    const queried: string[] = [];
    void fetchDisplayNames(fakeSupabase({}, queried), ["p1"]);

    expect(queried.sort()).toEqual(
      PLAYER_TYPE_OPTIONS.map((o) => DETAIL_SOURCE[o.value].table).sort(),
    );
  });

  it("reads each type's own name column", async () => {
    const names = await fetchDisplayNames(
      fakeSupabase({
        band_details: [{ profile_id: "b", band_name: "The Band" }],
        backline_details: [{ profile_id: "g", business_name: "Gear Co" }],
        rehearsal_studio_details: [{ profile_id: "r", business_name: "Room 9" }],
      }),
      ["b", "g", "r"],
    );

    expect(Object.fromEntries(names)).toEqual({
      b: "The Band",
      g: "Gear Co",
      r: "Room 9",
    });
  });

  it("falls back to the type's generic name when the name is blank", async () => {
    const names = await fetchDisplayNames(
      fakeSupabase({
        instrument_rental_details: [{ profile_id: "i", business_name: "" }],
        venue_details: [{ profile_id: "v", venue_name: null }],
      }),
      ["i", "v"],
    );

    expect(names.get("i")).toBe("Instrument rental");
    expect(names.get("v")).toBe("Venue");
  });

  it("keeps every other name when one table errors", async () => {
    // A table that isn't there yet (migration not run) must cost only its own
    // names, never the whole inbox.
    const names = await fetchDisplayNames(
      fakeSupabase({
        backline_details: "error",
        band_details: [{ profile_id: "b", band_name: "Still Here" }],
      }),
      ["b"],
    );

    expect(names.get("b")).toBe("Still Here");
  });

  it("makes no queries for an empty id list", async () => {
    const queried: string[] = [];
    const names = await fetchDisplayNames(fakeSupabase({}, queried), []);

    expect(names.size).toBe(0);
    expect(queried).toEqual([]);
  });
});

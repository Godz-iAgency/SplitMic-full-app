import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeNameForMatch,
  namesLikelyMatch,
  findMatch,
  findDirectoryVenueMatch,
  loadDirectoryVenueCandidates,
} from "./matching";

describe("normalizeNameForMatch", () => {
  it("lowercases, trims, and collapses whitespace", () => {
    expect(normalizeNameForMatch("  Test   Band  ")).toBe("test band");
  });

  it("strips a leading 'the '", () => {
    expect(normalizeNameForMatch("The Black Angels")).toBe("black angels");
  });

  it("does not strip 'the' mid-name", () => {
    expect(normalizeNameForMatch("Into The Wild")).toBe("into the wild");
  });
});

describe("namesLikelyMatch", () => {
  it("matches identical names", () => {
    expect(namesLikelyMatch("Mohawk Austin", "Mohawk Austin")).toBe(true);
  });

  it("matches case and whitespace differences", () => {
    expect(namesLikelyMatch("mohawk austin", "  Mohawk   Austin ")).toBe(true);
  });

  it("matches with/without a leading 'the'", () => {
    expect(namesLikelyMatch("The Black Angels", "Black Angels")).toBe(true);
  });

  it("matches a substring relationship of reasonable length", () => {
    expect(namesLikelyMatch("Mohawk", "Mohawk Austin")).toBe(true);
  });

  it("does not match unrelated names", () => {
    expect(namesLikelyMatch("Continental Club", "Antone's")).toBe(false);
  });

  it("guards against short-name false positives", () => {
    // "Mo" should not spuriously match "Mohawk" via substring matching.
    expect(namesLikelyMatch("Mo", "Mohawk")).toBe(false);
  });

  it("treats empty strings as non-matching", () => {
    expect(namesLikelyMatch("", "Mohawk")).toBe(false);
    expect(namesLikelyMatch("Mohawk", "")).toBe(false);
  });
});

describe("findMatch", () => {
  const candidates = {
    bands: [{ profileId: "band-1", name: "Test Band" }],
    venues: [{ profileId: "venue-1", name: "Mohawk Austin" }],
  };

  it("matches a band by artist name", () => {
    expect(findMatch(candidates, "Test Band", "Some Other Venue")).toEqual({
      profileId: "band-1",
      profileType: "band",
    });
  });

  it("matches a venue by venue name when no band matches", () => {
    expect(findMatch(candidates, "Unknown Artist", "Mohawk Austin")).toEqual({
      profileId: "venue-1",
      profileType: "venue",
    });
  });

  it("prefers the band match when both the artist and venue have a match", () => {
    const both = {
      bands: [{ profileId: "band-1", name: "Test Band" }],
      venues: [{ profileId: "venue-1", name: "Test Band" }], // contrived, but proves priority
    };
    expect(findMatch(both, "Test Band", "Test Band")).toEqual({
      profileId: "band-1",
      profileType: "band",
    });
  });

  it("returns null when nothing matches", () => {
    expect(findMatch(candidates, "Unknown Artist", "Unknown Venue")).toBeNull();
  });
});

describe("findDirectoryVenueMatch", () => {
  const candidates = [
    { businessId: "biz-1", name: "Mohawk Austin" },
    { businessId: "biz-2", name: "The Continental Club" },
  ];

  it("matches a directory venue by name", () => {
    expect(findDirectoryVenueMatch(candidates, "Mohawk Austin")).toBe("biz-1");
  });

  it("matches with/without a leading 'the', same as profile matching", () => {
    expect(findDirectoryVenueMatch(candidates, "Continental Club")).toBe("biz-2");
  });

  it("returns null when nothing matches", () => {
    expect(findDirectoryVenueMatch(candidates, "Some Other Venue")).toBeNull();
  });
});

describe("loadDirectoryVenueCandidates", () => {
  function fakeSupabase(rows: { id: string; business_name: string }[]) {
    const filters: { column: string; value: unknown }[] = [];
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push({ column, value });
        return builder;
      },
      then: (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null }),
    };
    const client = { from: () => builder } as unknown as SupabaseClient;
    return { client, filters };
  }

  it("scopes to active venue listings only", async () => {
    const { client, filters } = fakeSupabase([{ id: "biz-1", business_name: "Mohawk Austin" }]);
    const result = await loadDirectoryVenueCandidates(client);

    expect(filters).toContainEqual({ column: "category", value: "venue" });
    expect(filters).toContainEqual({ column: "is_active", value: true });
    expect(result).toEqual([{ businessId: "biz-1", name: "Mohawk Austin" }]);
  });

  it("returns an empty list rather than throwing when the query fails", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: null, error: { message: "boom" } }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await loadDirectoryVenueCandidates(client);
    expect(result).toEqual([]);
  });
});

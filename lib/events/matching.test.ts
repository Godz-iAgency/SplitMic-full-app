import { describe, it, expect } from "vitest";
import { normalizeNameForMatch, namesLikelyMatch, findMatch } from "./matching";

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

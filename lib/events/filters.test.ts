import { describe, it, expect } from "vitest";
import {
  matchesFreePaid,
  matchesGenre,
  matchesVenue,
  matchesAllFilters,
  distinctValues,
} from "./filters";
import type { LiveEventCard } from "./queries";

function makeEvent(overrides: Partial<LiveEventCard> = {}): LiveEventCard {
  return {
    id: "1",
    artistName: "Test Band",
    venueName: "Mohawk Austin",
    venueAddress: null,
    venueLatitude: null,
    venueLongitude: null,
    eventDatetime: "2026-08-20T01:00:00.000Z",
    isFree: null,
    imageUrl: null,
    ticketUrl: null,
    genre: null,
    source: "do512",
    matchedProfileId: null,
    matchedProfileType: null,
    directoryBusinessId: null,
    directoryPhotoUrl: null,
    ...overrides,
  };
}

describe("matchesFreePaid", () => {
  it('"all" matches everything regardless of isFree', () => {
    expect(matchesFreePaid(makeEvent({ isFree: true }), "all")).toBe(true);
    expect(matchesFreePaid(makeEvent({ isFree: false }), "all")).toBe(true);
    expect(matchesFreePaid(makeEvent({ isFree: null }), "all")).toBe(true);
  });

  it('"free" matches only isFree === true, strictly', () => {
    expect(matchesFreePaid(makeEvent({ isFree: true }), "free")).toBe(true);
    expect(matchesFreePaid(makeEvent({ isFree: false }), "free")).toBe(false);
    expect(matchesFreePaid(makeEvent({ isFree: null }), "free")).toBe(false);
  });

  it('"paid" matches "not confirmed free" — both false AND unknown/null', () => {
    // The regression this guards: most Ticketmaster rows have isFree = null
    // (never guessed at) despite being real ticketed shows. If "paid"
    // required isFree === false exactly, it would hide almost every actual
    // ticketed event and "Paid" would show almost nothing.
    expect(matchesFreePaid(makeEvent({ isFree: false }), "paid")).toBe(true);
    expect(matchesFreePaid(makeEvent({ isFree: null }), "paid")).toBe(true);
    expect(matchesFreePaid(makeEvent({ isFree: true }), "paid")).toBe(false);
  });
});

describe("matchesGenre", () => {
  it("matches everything when no genre filter is set", () => {
    expect(matchesGenre(makeEvent({ genre: "Rock" }), "")).toBe(true);
    expect(matchesGenre(makeEvent({ genre: null }), "")).toBe(true);
  });

  it("matches only an exact genre", () => {
    expect(matchesGenre(makeEvent({ genre: "Rock" }), "Rock")).toBe(true);
    expect(matchesGenre(makeEvent({ genre: "Country" }), "Rock")).toBe(false);
  });

  it("never matches a null genre against a specific filter", () => {
    expect(matchesGenre(makeEvent({ genre: null }), "Rock")).toBe(false);
  });
});

describe("matchesVenue", () => {
  it("matches everything when no venue filter is set", () => {
    expect(matchesVenue(makeEvent({ venueName: "Mohawk Austin" }), "")).toBe(true);
  });

  it("matches only an exact venue name", () => {
    expect(matchesVenue(makeEvent({ venueName: "Mohawk Austin" }), "Mohawk Austin")).toBe(true);
    expect(matchesVenue(makeEvent({ venueName: "ACL Live" }), "Mohawk Austin")).toBe(false);
  });
});

describe("matchesAllFilters", () => {
  it("requires every filter to pass, not just one", () => {
    const event = makeEvent({ isFree: true, genre: "Rock", venueName: "Mohawk Austin" });

    expect(
      matchesAllFilters(event, { freePaid: "free", genre: "Rock", venue: "Mohawk Austin" }),
    ).toBe(true);
    expect(
      matchesAllFilters(event, { freePaid: "free", genre: "Country", venue: "Mohawk Austin" }),
    ).toBe(false);
  });

  it("passes with the default (no-op) filter state", () => {
    const event = makeEvent();
    expect(matchesAllFilters(event, { freePaid: "all", genre: "", venue: "" })).toBe(true);
  });
});

describe("distinctValues", () => {
  it("returns each distinct value once, alphabetically sorted", () => {
    const events = [
      makeEvent({ genre: "Rock" }),
      makeEvent({ genre: "Country" }),
      makeEvent({ genre: "Rock" }),
    ];
    expect(distinctValues(events, (e) => e.genre)).toEqual(["Country", "Rock"]);
  });

  it("omits null values rather than including a blank option", () => {
    const events = [makeEvent({ genre: "Rock" }), makeEvent({ genre: null })];
    expect(distinctValues(events, (e) => e.genre)).toEqual(["Rock"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(distinctValues([], (e) => e.genre)).toEqual([]);
  });
});

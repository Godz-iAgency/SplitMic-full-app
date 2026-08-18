import { describe, it, expect } from "vitest";
import {
  matchesFreePaid,
  matchesGenre,
  matchesVenue,
  matchesAllFilters,
  distinctValues,
  selectTonightEvents,
  selectThisWeekEvents,
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

// 2026-08-17, 1pm Central (CDT). Cycle-key "today" is 2026-08-17.
const NOW = new Date("2026-08-17T18:00:00.000Z");
const TODAY = "2026-08-17T20:00:00.000Z"; // 3pm Central, today
const YESTERDAY = "2026-08-16T20:00:00.000Z"; // 3pm Central, yesterday
const TWO_DAYS_AGO = "2026-08-15T20:00:00.000Z";
const TOMORROW = "2026-08-18T20:00:00.000Z";
const NEXT_WEEK = "2026-08-24T20:00:00.000Z";

describe("selectTonightEvents", () => {
  it("returns today's events when there are any", () => {
    const events = [
      makeEvent({ id: "today", eventDatetime: TODAY }),
      makeEvent({ id: "yesterday", eventDatetime: YESTERDAY }),
    ];
    expect(selectTonightEvents(events, NOW).map((e) => e.id)).toEqual(["today"]);
  });

  it("never goes blank: falls back to the most recent past day when nothing is dated today", () => {
    // The regression this guards: a stalled sync (e.g. the daily scrape's
    // upstream API timing out) means nothing is dated for today's cycle yet.
    // Showing "no shows found for tonight" reads as "nothing's happening in
    // Austin," which is essentially never true — the real story is stale
    // data. Falling back to yesterday's real listings is always better.
    const events = [
      makeEvent({ id: "yesterday", eventDatetime: YESTERDAY }),
      makeEvent({ id: "two-days-ago", eventDatetime: TWO_DAYS_AGO }),
    ];
    expect(selectTonightEvents(events, NOW).map((e) => e.id)).toEqual(["yesterday"]);
  });

  it("picks the single most recent past day, not every past day combined", () => {
    const events = [
      makeEvent({ id: "yesterday-a", eventDatetime: YESTERDAY }),
      makeEvent({ id: "yesterday-b", eventDatetime: YESTERDAY }),
      makeEvent({ id: "two-days-ago", eventDatetime: TWO_DAYS_AGO }),
    ];
    const ids = selectTonightEvents(events, NOW).map((e) => e.id);
    expect(ids.sort()).toEqual(["yesterday-a", "yesterday-b"]);
  });

  it("never fabricates a fallback from future-only events", () => {
    const events = [makeEvent({ id: "tomorrow", eventDatetime: TOMORROW })];
    expect(selectTonightEvents(events, NOW)).toEqual([]);
  });

  it("returns an empty array only when there's truly nothing fetched", () => {
    expect(selectTonightEvents([], NOW)).toEqual([]);
  });
});

describe("selectThisWeekEvents", () => {
  it("returns upcoming, non-tonight events when there are any", () => {
    const events = [
      makeEvent({ id: "today", eventDatetime: TODAY }),
      makeEvent({ id: "next-week", eventDatetime: NEXT_WEEK }),
    ];
    expect(selectThisWeekEvents(events, NOW).map((e) => e.id)).toEqual(["next-week"]);
  });

  it("never goes blank: falls back to past non-tonight events when nothing is upcoming", () => {
    const events = [
      makeEvent({ id: "today", eventDatetime: TODAY }),
      makeEvent({ id: "yesterday", eventDatetime: YESTERDAY }),
      makeEvent({ id: "two-days-ago", eventDatetime: TWO_DAYS_AGO }),
    ];
    const ids = selectThisWeekEvents(events, NOW).map((e) => e.id).sort();
    expect(ids).toEqual(["two-days-ago", "yesterday"]);
  });

  it("always excludes tonight's events, fallback or not", () => {
    const events = [makeEvent({ id: "today", eventDatetime: TODAY })];
    expect(selectThisWeekEvents(events, NOW)).toEqual([]);
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

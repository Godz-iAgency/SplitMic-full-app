import { describe, it, expect } from "vitest";
import { isToday, formatEventDayLabel, formatEventTime } from "./time";

// All times below are UTC instants chosen so their Chicago-local wall clock
// is unambiguous and outside any DST transition window.
// 2026-08-13 is CDT (UTC-5): 01:00Z Aug 13 = 8:00pm Chicago Aug 12.

describe("isToday (9am-9am Chicago cycle, not midnight)", () => {
  it("is true for an event earlier today, checked the same afternoon", () => {
    const now = "2026-08-13T20:00:00.000Z"; // 3pm Chicago Aug 13
    const eventSameEvening = "2026-08-14T01:00:00.000Z"; // 8pm Chicago Aug 13
    expect(isToday(eventSameEvening, new Date(now))).toBe(true);
  });

  it("stays true late at night, well after the show started", () => {
    const eventStart = "2026-08-14T01:00:00.000Z"; // 8pm Chicago Aug 13
    const laterSameNight = "2026-08-14T04:00:00.000Z"; // 11pm Chicago Aug 13
    expect(isToday(eventStart, new Date(laterSameNight))).toBe(true);
  });

  it("is still true checked at 5am, before the 9am rollover", () => {
    const eventStart = "2026-08-14T01:00:00.000Z"; // 8pm Chicago Aug 13
    const earlyNextMorning = "2026-08-14T10:00:00.000Z"; // 5am Chicago Aug 14
    expect(isToday(eventStart, new Date(earlyNextMorning))).toBe(true);
  });

  it("becomes false once checked after the 9am rollover", () => {
    const eventStart = "2026-08-14T01:00:00.000Z"; // 8pm Chicago Aug 13
    const nextMorningAfterCycle = "2026-08-14T15:00:00.000Z"; // 10am Chicago Aug 14
    expect(isToday(eventStart, new Date(nextMorningAfterCycle))).toBe(false);
  });

  it("is true for an event right at the 9am boundary, checked a moment later", () => {
    const eventAt9am = "2026-08-13T14:00:00.000Z"; // 9:00am Chicago Aug 13
    const justAfter = "2026-08-13T14:05:00.000Z";
    expect(isToday(eventAt9am, new Date(justAfter))).toBe(true);
  });

  it("is false for an event one minute before the 9am boundary", () => {
    const eventAt859am = "2026-08-13T13:59:00.000Z"; // 8:59am Chicago Aug 13
    const checkedAt9am = "2026-08-13T14:00:00.000Z";
    expect(isToday(eventAt859am, new Date(checkedAt9am))).toBe(false);
  });
});

describe("formatEventDayLabel", () => {
  it("labels an event later tonight as Tonight, even after its start time", () => {
    const eventStart = "2026-08-14T01:00:00.000Z"; // 8pm Chicago Aug 13
    const laterSameNight = "2026-08-14T04:00:00.000Z"; // 11pm Chicago Aug 13
    expect(formatEventDayLabel(eventStart, new Date(laterSameNight))).toBe("Tonight");
  });

  it("stays Tonight until the 9am cycle rolls over, not at midnight", () => {
    const eventStart = "2026-08-14T01:00:00.000Z"; // 8pm Chicago Aug 13
    const at2am = "2026-08-14T07:00:00.000Z"; // 2am Chicago Aug 14 — past midnight
    expect(formatEventDayLabel(eventStart, new Date(at2am))).toBe("Tonight");
  });

  it("switches away from Tonight after the next 9am sync would have run", () => {
    const eventStart = "2026-08-14T01:00:00.000Z"; // 8pm Chicago Aug 13
    const nextMorning = "2026-08-14T15:00:00.000Z"; // 10am Chicago Aug 14
    expect(formatEventDayLabel(eventStart, new Date(nextMorning))).not.toBe("Tonight");
  });

  it("labels tomorrow's cycle as Tomorrow", () => {
    const now = "2026-08-13T20:00:00.000Z"; // 3pm Chicago Aug 13
    const tomorrowEvening = "2026-08-15T01:00:00.000Z"; // 8pm Chicago Aug 14
    expect(formatEventDayLabel(tomorrowEvening, new Date(now))).toBe("Tomorrow");
  });

  it("falls back to a weekday/date label further out", () => {
    const now = "2026-08-13T20:00:00.000Z";
    const nextWeek = "2026-08-20T01:00:00.000Z";
    const label = formatEventDayLabel(nextWeek, new Date(now));
    expect(label).not.toBe("Tonight");
    expect(label).not.toBe("Tomorrow");
    expect(label).toContain("Aug");
  });
});

describe("formatEventTime", () => {
  it("formats in Chicago local time", () => {
    expect(formatEventTime("2026-08-14T01:00:00.000Z")).toBe("8:00 PM");
  });
});

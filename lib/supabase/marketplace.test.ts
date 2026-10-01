import { describe, expect, it } from "vitest";
import {
  canPostEvents,
  canPostOpenMic,
  isPostingPlayerType,
  postExpiryDate,
} from "./marketplace";
import { PLAYER_TYPE_OPTIONS, type PlayerType } from "@/lib/types";

describe("postExpiryDate", () => {
  it("expires an open mic seven days after its date without an opportunity deadline", () => {
    expect(postExpiryDate("open_mic", { event_date: "2026-09-30" })).toBe("2026-10-07");
  });
  it("uses a festival's last day", () => {
    expect(postExpiryDate("event", { event_date: "2026-09-14", event_end_date: "2026-09-16" })).toBe("2026-09-23");
  });
  it("uses a single-day event's start", () => {
    expect(postExpiryDate("event", { event_date: "2026-12-31" })).toBe("2027-01-07");
  });
  it("uses an opportunity's deadline", () => {
    expect(postExpiryDate("opportunity", { open_until: "2026-09-14" })).toBe("2026-09-21");
  });
  it.each([undefined, "", "garbage", "2026-02-30", "2026-13-01"])("rejects invalid date %s without throwing", (event_date) => {
    expect(postExpiryDate("open_mic", { event_date })).toBeNull();
  });
});

describe("who can post", () => {
  // Every player type must be classified here: `satisfies` fails the type
  // check the moment a new type is added without a decision. The regression
  // this guards is the one step23 fixed in the database: a rule written as
  // "anyone who isn't a band" silently let new types through.
  const EXPECTED = {
    band: { post: false, events: false, openMic: false },
    venue: { post: true, events: true, openMic: true },
    talent_buyer: { post: true, events: false, openMic: false },
    record_label: { post: true, events: false, openMic: false },
    festival: { post: true, events: true, openMic: false },
    backline: { post: false, events: false, openMic: false },
    instrument_rental: { post: false, events: false, openMic: false },
    rehearsal_studio: { post: false, events: false, openMic: false },
  } satisfies Record<PlayerType, { post: boolean; events: boolean; openMic: boolean }>;

  it.each(Object.entries(EXPECTED))("%s", (type, can) => {
    const t = type as PlayerType;
    expect(isPostingPlayerType(t)).toBe(can.post);
    expect(canPostEvents(t)).toBe(can.events);
    expect(canPostOpenMic(t)).toBe(can.openMic);
  });

  it("covers every player type the app offers", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      PLAYER_TYPE_OPTIONS.map((o) => o.value).sort(),
    );
  });
});

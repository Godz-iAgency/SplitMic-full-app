import { describe, expect, it } from "vitest";
import { isIndustryPlayerType } from "./messaging";
import { PLAYER_TYPE_OPTIONS, type PlayerType } from "@/lib/types";

describe("isIndustryPlayerType (who can message anyone without a Connect request)", () => {
  // `satisfies` makes adding a player type without deciding this a type error.
  // Only these four skip Connect; bands and the gear and rehearsal businesses
  // must send a request first (PROGRESS.md §2 #27). Must match the list in the
  // mt_party_insert policy (migrations/step23_vendor_player_types.sql).
  const DIRECT = {
    band: false,
    venue: true,
    talent_buyer: true,
    record_label: true,
    festival: true,
    backline: false,
    instrument_rental: false,
    rehearsal_studio: false,
  } satisfies Record<PlayerType, boolean>;

  it.each(Object.entries(DIRECT))("%s → %s", (type, direct) => {
    expect(isIndustryPlayerType(type as PlayerType)).toBe(direct);
  });

  it("covers every player type the app offers", () => {
    expect(Object.keys(DIRECT).sort()).toEqual(
      PLAYER_TYPE_OPTIONS.map((o) => o.value).sort(),
    );
  });
});

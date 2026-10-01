import { describe, expect, it } from "vitest";
import {
  BACKLINE_EQUIPMENT,
  STUDIO_GEAR,
  labelsFor,
  pickKnown,
  vendorOneLiner,
} from "./vendorOptions";

describe("pickKnown", () => {
  it("keeps only values in the option list", () => {
    expect(pickKnown(BACKLINE_EQUIPMENT, ["pa", "forged", "drums"])).toEqual([
      "drums",
      "pa",
    ]);
  });

  it("returns them in the list's own order, once each", () => {
    expect(pickKnown(BACKLINE_EQUIPMENT, ["lighting", "drums", "lighting"])).toEqual([
      "drums",
      "lighting",
    ]);
  });

  it.each([null, undefined, "drums", 42, [42, null]])(
    "treats a malformed value (%j) as nothing chosen",
    (value) => {
      expect(pickKnown(BACKLINE_EQUIPMENT, value)).toEqual([]);
    },
  );
});

describe("labelsFor", () => {
  it("shows labels, never the raw slug", () => {
    // "pa" must read "PA", and studio "pa" reads "PA system": labels come from
    // each list, not from title-casing the slug.
    expect(labelsFor(BACKLINE_EQUIPMENT, ["pa"])).toEqual(["PA"]);
    expect(labelsFor(STUDIO_GEAR, ["pa"])).toEqual(["PA system"]);
  });

  it("skips anything outside the list instead of printing it", () => {
    expect(labelsFor(BACKLINE_EQUIPMENT, ["<script>", "amps"])).toEqual(["Amps"]);
  });
});

describe("vendorOneLiner", () => {
  it("summarizes backline gear and delivery", () => {
    expect(
      vendorOneLiner("backline", { equipment: ["drums", "amps", "pa"], delivers: true }),
    ).toBe("Drums, Amps, PA · Delivers");
  });

  it("leaves delivery out unless they said they deliver", () => {
    expect(vendorOneLiner("backline", { equipment: ["keys"], delivers: false })).toBe(
      "Keys",
    );
    expect(vendorOneLiner("instrument_rental", { instruments: ["dj_gear"], delivers: null })).toBe(
      "DJ gear",
    );
  });

  it("summarizes a studio by rooms, then gear", () => {
    expect(
      vendorOneLiner("rehearsal_studio", { room_count: 4, gear_included: ["drum_kit", "pa"] }),
    ).toBe("4 rooms · Drum kit, PA system");
    expect(vendorOneLiner("rehearsal_studio", { room_count: 1, gear_included: [] })).toBe(
      "1 room",
    );
  });

  it("never leaves a card blank", () => {
    expect(vendorOneLiner("backline", {})).toBe("Backline company");
    expect(vendorOneLiner("instrument_rental", { instruments: ["forged"] })).toBe(
      "Instrument rental",
    );
    expect(vendorOneLiner("rehearsal_studio", { room_count: 0 })).toBe("Rehearsal studio");
  });
});

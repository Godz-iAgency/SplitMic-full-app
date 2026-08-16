import { describe, it, expect } from "vitest";
import { buildDirectionsUrl, buildUberUrl } from "./getThereLinks";
import type { LiveEventCard } from "./queries";

function makeEvent(overrides: Partial<LiveEventCard> = {}): LiveEventCard {
  return {
    id: "1",
    artistName: "Test Band",
    venueName: "Mohawk Austin",
    venueAddress: null,
    venueLatitude: null,
    venueLongitude: null,
    eventDatetime: "2026-08-16T01:00:00.000Z",
    isFree: null,
    imageUrl: null,
    ticketUrl: null,
    matchedProfileId: null,
    matchedProfileType: null,
    directoryBusinessId: null,
    directoryPhotoUrl: null,
    ...overrides,
  };
}

describe("buildDirectionsUrl", () => {
  it("prefers coordinates over a street address", () => {
    const url = buildDirectionsUrl(
      makeEvent({ venueAddress: "912 Red River St", venueLatitude: 30.267, venueLongitude: -97.74 }),
    );
    expect(url).toContain(encodeURIComponent("30.267,-97.74"));
  });

  it("falls back to the street address when there are no coordinates", () => {
    const url = buildDirectionsUrl(makeEvent({ venueAddress: "912 Red River St" }));
    expect(url).toContain(encodeURIComponent("912 Red River St"));
  });

  it("falls back to the venue name scoped to Austin when nothing else is known", () => {
    const url = buildDirectionsUrl(makeEvent());
    expect(url).toContain(encodeURIComponent("Mohawk Austin, Austin, TX"));
  });
});

describe("buildUberUrl", () => {
  it("includes lat/lng params when coordinates are known", () => {
    const url = buildUberUrl(makeEvent({ venueLatitude: 30.267, venueLongitude: -97.74 }));
    expect(url).toContain("dropoff%5Blatitude%5D=30.267");
    expect(url).toContain("dropoff%5Blongitude%5D=-97.74");
  });

  it("omits lat/lng params when coordinates are unknown", () => {
    const url = buildUberUrl(makeEvent());
    expect(url).not.toContain("latitude");
  });

  it("uses the venue name scoped to Austin when there's no stored address", () => {
    // URLSearchParams encodes spaces as "+", not "%20" — assert via decoded
    // params rather than a raw substring match.
    const url = buildUberUrl(makeEvent());
    const params = new URL(url).searchParams;
    expect(params.get("dropoff[formatted_address]")).toBe("Mohawk Austin, Austin, TX");
  });
});

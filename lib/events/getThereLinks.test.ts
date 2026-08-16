import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
  function dropParam(url: string): Record<string, unknown> {
    const raw = new URL(url).searchParams.get("drop[0]");
    expect(raw).not.toBeNull();
    return JSON.parse(raw as string);
  }

  it("uses the current documented m.uber.com/looking endpoint", () => {
    const url = buildUberUrl(makeEvent());
    expect(url.startsWith("https://m.uber.com/looking?")).toBe(true);
  });

  it("includes lat/lng in the drop[0] object when coordinates are known", () => {
    const drop = dropParam(
      buildUberUrl(makeEvent({ venueLatitude: 30.267, venueLongitude: -97.74 })),
    );
    expect(drop.latitude).toBe(30.267);
    expect(drop.longitude).toBe(-97.74);
  });

  it("omits latitude/longitude keys entirely when coordinates are unknown", () => {
    const drop = dropParam(buildUberUrl(makeEvent()));
    expect(drop).not.toHaveProperty("latitude");
    expect(drop).not.toHaveProperty("longitude");
  });

  it("always sets addressLine1 to the venue name", () => {
    const drop = dropParam(buildUberUrl(makeEvent({ venueName: "Mohawk Austin" })));
    expect(drop.addressLine1).toBe("Mohawk Austin");
  });

  it("sets addressLine2 to the street address when one is stored", () => {
    const drop = dropParam(buildUberUrl(makeEvent({ venueAddress: "912 Red River St" })));
    expect(drop.addressLine2).toBe("912 Red River St");
  });

  it("omits addressLine2 when there's no stored address", () => {
    const drop = dropParam(buildUberUrl(makeEvent()));
    expect(drop).not.toHaveProperty("addressLine2");
  });

  it("never sends a pickup param, so Uber uses the rider's current location", () => {
    const url = buildUberUrl(makeEvent());
    expect(new URL(url).searchParams.has("pickup")).toBe(false);
  });

  describe("client_id", () => {
    const originalClientId = process.env.NEXT_PUBLIC_UBER_CLIENT_ID;

    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_UBER_CLIENT_ID;
    });

    afterEach(() => {
      if (originalClientId === undefined) {
        delete process.env.NEXT_PUBLIC_UBER_CLIENT_ID;
      } else {
        process.env.NEXT_PUBLIC_UBER_CLIENT_ID = originalClientId;
      }
    });

    it("includes client_id when the app's Client ID is configured", () => {
      process.env.NEXT_PUBLIC_UBER_CLIENT_ID = "test-client-id";
      const params = new URL(buildUberUrl(makeEvent())).searchParams;
      expect(params.get("client_id")).toBe("test-client-id");
    });

    it("omits client_id entirely rather than sending it empty when unset", () => {
      const url = buildUberUrl(makeEvent());
      expect(new URL(url).searchParams.has("client_id")).toBe(false);
    });
  });
});

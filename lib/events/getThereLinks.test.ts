import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildDirectionsUrl,
  buildUberUrl,
  buildUberAppIntentUrl,
  buildTicketUrl,
} from "./getThereLinks";
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
    genre: null,
    source: "do512",
    matchedProfileId: null,
    matchedProfileType: null,
    directoryBusinessId: null,
    directoryPhotoUrl: null,
    ...overrides,
  };
}

describe("buildTicketUrl", () => {
  it("returns the stored ticket URL", () => {
    const url = buildTicketUrl(makeEvent({ ticketUrl: "https://ticketmaster.com/event/1" }));
    expect(url).toBe("https://ticketmaster.com/event/1");
  });

  it("returns null when there's no ticket URL, so the caller can hide the button", () => {
    expect(buildTicketUrl(makeEvent({ ticketUrl: null }))).toBeNull();
  });
});

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

describe("buildUberAppIntentUrl", () => {
  // An intent URL is opaque to the URL parser, and a malformed one fails
  // silently — Chrome just does nothing or drops to the fallback — so these
  // assert the exact structural pieces Chrome actually parses.
  function intentQuery(url: string): URLSearchParams {
    const query = url.slice(url.indexOf("?") + 1, url.indexOf("#Intent;"));
    return new URLSearchParams(query);
  }

  it("targets the Uber rider app explicitly, which is the whole point", () => {
    // package= is what makes this an explicit intent, bypassing the Android
    // App Links verification that was failing on a real device.
    const url = buildUberAppIntentUrl(makeEvent());
    expect(url.startsWith("intent://riderequest?")).toBe(true);
    expect(url).toContain("scheme=uber");
    expect(url).toContain("package=com.ubercab");
    expect(url.endsWith(";end")).toBe(true);
  });

  it("falls back to the https link when the app isn't installed", () => {
    const event = makeEvent();
    const url = buildUberAppIntentUrl(event);
    const match = /S\.browser_fallback_url=([^;]+);/.exec(url);
    expect(match).not.toBeNull();
    expect(decodeURIComponent(match![1])).toBe(buildUberUrl(event));
  });

  it("always sends a dropoff name and address", () => {
    // Uber's deep-link FAQ: the dropoff will not appear in the native app at
    // all unless nickname or formatted_address is present.
    const params = intentQuery(buildUberAppIntentUrl(makeEvent()));
    expect(params.get("dropoff[nickname]")).toBe("Mohawk Austin");
    expect(params.get("dropoff[formatted_address]")).toBe(
      "Mohawk Austin, Austin, TX",
    );
  });

  it("prefers the real street address for formatted_address", () => {
    const params = intentQuery(
      buildUberAppIntentUrl(makeEvent({ venueAddress: "912 Red River St" })),
    );
    expect(params.get("dropoff[formatted_address]")).toBe("912 Red River St");
  });

  it("starts the ride from the rider's current location", () => {
    const params = intentQuery(buildUberAppIntentUrl(makeEvent()));
    expect(params.get("action")).toBe("setPickup");
    expect(params.get("pickup")).toBe("my_location");
  });

  it("includes dropoff coordinates when known, omits them when not", () => {
    const withCoords = intentQuery(
      buildUberAppIntentUrl(
        makeEvent({ venueLatitude: 30.267, venueLongitude: -97.74 }),
      ),
    );
    expect(withCoords.get("dropoff[latitude]")).toBe("30.267");
    expect(withCoords.get("dropoff[longitude]")).toBe("-97.74");

    const without = intentQuery(buildUberAppIntentUrl(makeEvent()));
    expect(without.has("dropoff[latitude]")).toBe(false);
    expect(without.has("dropoff[longitude]")).toBe(false);
  });

  it("uses the native bracket format, not the web link's drop[0] JSON", () => {
    // The two documented formats are not interchangeable: drop[0] is for
    // m.uber.com/looking, brackets are for the uber:// native scheme.
    // Sending the wrong one is exactly how the dropoff silently goes missing.
    const url = buildUberAppIntentUrl(makeEvent());
    expect(intentQuery(url).has("drop[0]")).toBe(false);
  });
});

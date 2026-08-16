import { describe, it, expect } from "vitest";
import { buildEventsJsonLd, buildFaqJsonLd } from "./jsonld";
import { FAQ_ITEMS } from "./faqContent";
import type { LiveEventCard } from "./queries";

const EVENT: LiveEventCard = {
  id: "evt-1",
  artistName: "Test Band",
  venueName: "Mohawk Austin",
  venueAddress: "912 Red River St, Austin, TX",
  venueLatitude: 30.267,
  venueLongitude: -97.738,
  eventDatetime: "2026-08-16T01:00:00.000Z",
  isFree: true,
  imageUrl: "https://example.com/img.jpg",
  ticketUrl: "https://example.com/tickets",
  matchedProfileId: "profile-1",
  matchedProfileType: "band",
  directoryBusinessId: null,
  directoryPhotoUrl: null,
};

describe("buildEventsJsonLd", () => {
  it("produces a MusicEvent graph with the required schema.org fields", () => {
    const jsonld = buildEventsJsonLd([EVENT], "https://splitmic.com");
    const [entry] = jsonld["@graph"];

    expect(entry["@type"]).toBe("MusicEvent");
    expect(entry.startDate).toBe(EVENT.eventDatetime);
    expect(entry.location).toMatchObject({
      "@type": "MusicVenue",
      name: "Mohawk Austin",
      address: "912 Red River St, Austin, TX",
    });
    expect(entry.performer).toMatchObject({
      "@type": "MusicGroup",
      name: "Test Band",
      sameAs: "https://splitmic.com/profile/profile-1",
    });
    expect(entry.eventStatus).toBe("https://schema.org/EventScheduled");
  });

  it("omits sameAs when there is no matched profile", () => {
    const unmatched = { ...EVENT, matchedProfileId: null, matchedProfileType: null };
    const jsonld = buildEventsJsonLd([unmatched], "https://splitmic.com");
    expect(jsonld["@graph"][0].performer.sameAs).toBeUndefined();
  });

  it("falls back to the venue name + city when no street address is known", () => {
    const noAddress = { ...EVENT, venueAddress: null };
    const jsonld = buildEventsJsonLd([noAddress], "https://splitmic.com");
    expect(jsonld["@graph"][0].location.address).toBe("Mohawk Austin, Austin, TX");
  });

  it("returns an empty graph for no events", () => {
    expect(buildEventsJsonLd([], "https://splitmic.com")["@graph"]).toEqual([]);
  });

  it("falls back to the directory listing for url/image when there's no profile or ticket link", () => {
    const directoryOnly = {
      ...EVENT,
      imageUrl: null, // no Do512 poster, so directoryPhotoUrl should win
      ticketUrl: null,
      matchedProfileId: null,
      matchedProfileType: null,
      directoryBusinessId: "biz-1",
      directoryPhotoUrl: "https://example.com/venue-photo.jpg",
    };
    const jsonld = buildEventsJsonLd([directoryOnly], "https://splitmic.com");
    const entry = jsonld["@graph"][0];
    expect(entry.url).toBe("https://splitmic.com/directory/venues#b-biz-1");
    expect(entry.image).toBe("https://example.com/venue-photo.jpg");
  });

  it("prefers ticketUrl over any matched destination", () => {
    const withEverything = { ...EVENT, directoryBusinessId: "biz-1" };
    const jsonld = buildEventsJsonLd([withEverything], "https://splitmic.com");
    expect(jsonld["@graph"][0].url).toBe(EVENT.ticketUrl);
  });

  it("falls back to the internal anchor when nothing matched at all", () => {
    const nothingMatched = {
      ...EVENT,
      ticketUrl: null,
      matchedProfileId: null,
      matchedProfileType: null,
      directoryBusinessId: null,
    };
    const jsonld = buildEventsJsonLd([nothingMatched], "https://splitmic.com");
    expect(jsonld["@graph"][0].url).toBe(`https://splitmic.com/live#event-${EVENT.id}`);
  });
});

describe("buildFaqJsonLd", () => {
  it("matches FAQ_ITEMS verbatim, question for question and answer for answer", () => {
    const jsonld = buildFaqJsonLd();
    expect(jsonld.mainEntity).toHaveLength(FAQ_ITEMS.length);
    jsonld.mainEntity.forEach((entry, i) => {
      expect(entry.name).toBe(FAQ_ITEMS[i].question);
      expect(entry.acceptedAnswer.text).toBe(FAQ_ITEMS[i].answer);
    });
  });

  it("uses the FAQPage schema type", () => {
    expect(buildFaqJsonLd()["@type"]).toBe("FAQPage");
  });
});

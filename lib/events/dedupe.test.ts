import { describe, it, expect } from "vitest";
import { dedupeAcrossProviders } from "./dedupe";
import type { LiveEventCard } from "./queries";

function makeCard(overrides: Partial<LiveEventCard> = {}): LiveEventCard {
  return {
    id: "1",
    artistName: "Gary Clark Jr.",
    venueName: "ACL Live",
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

describe("dedupeAcrossProviders", () => {
  it("collapses the same show reported by both providers into one card", () => {
    const do512Card = makeCard({ id: "do512-1", source: "do512" });
    const tmCard = makeCard({ id: "tm-1", source: "ticketmaster" });

    const result = dedupeAcrossProviders([do512Card, tmCard]);

    expect(result).toHaveLength(1);
  });

  it("prefers the Ticketmaster row over Do512 when both exist", () => {
    const do512Card = makeCard({ id: "do512-1", source: "do512", ticketUrl: null });
    const tmCard = makeCard({
      id: "tm-1",
      source: "ticketmaster",
      ticketUrl: "https://ticketmaster.com/event/1",
      genre: "Rock",
    });

    const result = dedupeAcrossProviders([do512Card, tmCard]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("tm-1");
    expect(result[0].ticketUrl).toBe("https://ticketmaster.com/event/1");
  });

  it("prefers Ticketmaster regardless of which one appears first in the list", () => {
    const do512Card = makeCard({ id: "do512-1", source: "do512" });
    const tmCard = makeCard({ id: "tm-1", source: "ticketmaster" });

    const result = dedupeAcrossProviders([tmCard, do512Card]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("tm-1");
  });

  it("does NOT collapse two rows from the same provider — that's the DB's job, not this function's", () => {
    const cardA = makeCard({ id: "1", source: "do512" });
    const cardB = makeCard({ id: "2", source: "do512" });

    const result = dedupeAcrossProviders([cardA, cardB]);

    expect(result).toHaveLength(2);
  });

  it("keeps two genuinely different shows at the same venue on the same night", () => {
    const earlyShow = makeCard({
      id: "1",
      source: "do512",
      artistName: "Band A",
      eventDatetime: "2026-08-20T00:00:00.000Z",
    });
    const lateShow = makeCard({
      id: "2",
      source: "ticketmaster",
      artistName: "Totally Different Band",
      eventDatetime: "2026-08-20T02:00:00.000Z",
    });

    const result = dedupeAcrossProviders([earlyShow, lateShow]);

    expect(result).toHaveLength(2);
  });

  it("keeps the same artist at two different venues on the same night", () => {
    const venueA = makeCard({ id: "1", source: "do512", venueName: "Mohawk Austin" });
    const venueB = makeCard({ id: "2", source: "ticketmaster", venueName: "ACL Live" });

    const result = dedupeAcrossProviders([venueA, venueB]);

    expect(result).toHaveLength(2);
  });

  it("treats close-but-not-identical times as the same show (doors vs set time)", () => {
    const doorsTime = makeCard({
      id: "do512-1",
      source: "do512",
      eventDatetime: "2026-08-20T00:00:00.000Z",
    });
    const setTime = makeCard({
      id: "tm-1",
      source: "ticketmaster",
      eventDatetime: "2026-08-20T01:30:00.000Z", // 90 min later, within the window
    });

    const result = dedupeAcrossProviders([doorsTime, setTime]);

    expect(result).toHaveLength(1);
  });

  it("does not collapse the same act at the same venue on genuinely different nights", () => {
    const nightOne = makeCard({
      id: "1",
      source: "do512",
      eventDatetime: "2026-08-20T01:00:00.000Z",
    });
    const nightTwo = makeCard({
      id: "2",
      source: "ticketmaster",
      eventDatetime: "2026-08-21T01:00:00.000Z", // 24h later
    });

    const result = dedupeAcrossProviders([nightOne, nightTwo]);

    expect(result).toHaveLength(2);
  });

  it("tolerates minor venue name formatting differences between providers", () => {
    // Real example: Do512 says "ACL Live", Ticketmaster says
    // "ACL Live at The Moody Theater" — namesLikelyMatch already handles
    // substring matches, this just proves dedupe actually uses it.
    const do512Card = makeCard({ id: "1", source: "do512", venueName: "ACL Live" });
    const tmCard = makeCard({
      id: "2",
      source: "ticketmaster",
      venueName: "ACL Live at The Moody Theater",
    });

    const result = dedupeAcrossProviders([do512Card, tmCard]);

    expect(result).toHaveLength(1);
  });

  it("never deletes anything — it only ever returns a subset of its input", () => {
    // The architectural guarantee this whole module exists to provide:
    // nothing here can ever produce a card that wasn't in the input, only
    // fewer of them.
    const cards = [
      makeCard({ id: "1", source: "do512" }),
      makeCard({ id: "2", source: "ticketmaster" }),
      makeCard({ id: "3", source: "do512", artistName: "Someone Else" }),
    ];

    const result = dedupeAcrossProviders(cards);

    for (const card of result) {
      expect(cards).toContain(card);
    }
  });

  it("passes through a single-source list completely unchanged", () => {
    const cards = [
      makeCard({ id: "1", source: "do512" }),
      makeCard({ id: "2", source: "do512", artistName: "Another Band" }),
    ];

    expect(dedupeAcrossProviders(cards)).toEqual(cards);
  });

  it("handles an empty list", () => {
    expect(dedupeAcrossProviders([])).toEqual([]);
  });
});

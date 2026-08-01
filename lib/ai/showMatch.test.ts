import { describe, it, expect, vi, beforeEach } from "vitest";

// Gemini is mocked for every test in this file: these cover OUR handling of the
// model's reply (validation, normalization, failure fallback), not the model's
// accuracy. A test that made a real API call would be slow, cost money, and
// fail for reasons unrelated to this code.
vi.mock("./gemini", () => ({
  generateJson: vi.fn(),
}));

import { generateJson } from "./gemini";
import { extractShowCriteria, EMPTY_CRITERIA, DRAW_ORDER } from "./showMatch";

const mockGenerateJson = vi.mocked(generateJson);

/** Make Gemini "return" this object. */
function respondWith(data: unknown) {
  mockGenerateJson.mockResolvedValue({ ok: true, data } as never);
}

/** Make Gemini fail (down, timed out, no API key). */
function respondWithFailure(reason = "Gemini timed out") {
  mockGenerateJson.mockResolvedValue({ ok: false, reason } as never);
}

beforeEach(() => {
  mockGenerateJson.mockReset();
});

describe("extractShowCriteria", () => {
  it("passes through a well-formed reply", async () => {
    respondWith({
      genres: ["Reggae", "Ska"],
      minDraw: "75-200",
      maxMemberCount: 5,
      keywords: ["upbeat"],
    });

    const { criteria, aiUsed } = await extractShowCriteria("reggae show");

    expect(aiUsed).toBe(true);
    expect(criteria).toEqual({
      genres: ["Reggae", "Ska"],
      minDraw: "75-200",
      maxMemberCount: 5,
      keywords: ["upbeat"],
    });
  });

  it("skips the model call entirely for a blank description", async () => {
    const { criteria, aiUsed } = await extractShowCriteria("   ");

    expect(mockGenerateJson).not.toHaveBeenCalled();
    expect(aiUsed).toBe(false);
    expect(criteria).toEqual(EMPTY_CRITERIA);
  });

  describe("when Gemini is unavailable", () => {
    it("reports the failure instead of throwing, so the caller can degrade", async () => {
      respondWithFailure("Gemini timed out");

      const { criteria, aiUsed, reason } = await extractShowCriteria("a show");

      expect(aiUsed).toBe(false);
      expect(reason).toBe("Gemini timed out");
      expect(criteria).toEqual(EMPTY_CRITERIA);
    });
  });

  describe("validating what the model sends back", () => {
    // responseSchema is a strong hint to Gemini, not a guarantee — and a genre
    // that no longer exists would become a filter matching nobody.
    it("drops genres that aren't in our taxonomy", async () => {
      respondWith({ genres: ["Reggae", "Sea Shanty", "Ska"], keywords: [] });

      const { criteria } = await extractShowCriteria("a show");

      expect(criteria.genres).toEqual(["Reggae", "Ska"]);
    });

    it("de-duplicates repeated genres", async () => {
      respondWith({ genres: ["Rock", "Rock", "Rock"], keywords: [] });

      const { criteria } = await extractShowCriteria("a show");

      expect(criteria.genres).toEqual(["Rock"]);
    });

    it("drops an unrecognized draw bucket", async () => {
      respondWith({ genres: [], minDraw: "a-million", keywords: [] });

      const { criteria } = await extractShowCriteria("a show");

      expect(criteria.minDraw).toBeNull();
    });

    it("rejects a zero or negative band size", async () => {
      respondWith({ genres: [], maxMemberCount: 0, keywords: [] });
      expect((await extractShowCriteria("a show")).criteria.maxMemberCount).toBeNull();

      respondWith({ genres: [], maxMemberCount: -3, keywords: [] });
      expect((await extractShowCriteria("a show")).criteria.maxMemberCount).toBeNull();
    });

    it("rounds and caps an implausible band size", async () => {
      respondWith({ genres: [], maxMemberCount: 4.6, keywords: [] });
      expect((await extractShowCriteria("a show")).criteria.maxMemberCount).toBe(5);

      respondWith({ genres: [], maxMemberCount: 5000, keywords: [] });
      expect((await extractShowCriteria("a show")).criteria.maxMemberCount).toBe(50);
    });

    it("survives a reply with the wrong types throughout", async () => {
      respondWith({
        genres: "Reggae",
        minDraw: 42,
        maxMemberCount: "five",
        keywords: null,
      });

      const { criteria } = await extractShowCriteria("a show");

      expect(criteria).toEqual(EMPTY_CRITERIA);
    });

    it("survives a completely empty reply", async () => {
      respondWith({});
      expect((await extractShowCriteria("a show")).criteria).toEqual(EMPTY_CRITERIA);
    });
  });

  describe("keyword normalization", () => {
    it("lowercases and de-duplicates", async () => {
      respondWith({ genres: [], keywords: ["Loud", "loud", "  MELLOW  "] });

      const { criteria } = await extractShowCriteria("a show");

      expect(criteria.keywords).toEqual(["loud", "mellow"]);
    });

    it("drops genre names so they can't score twice", async () => {
      // "acoustic" is both a vibe word and a real genre (Acoustic). Counting it
      // as a keyword too would double-score bands already matched on genre.
      respondWith({ genres: ["Acoustic"], keywords: ["acoustic", "mellow"] });

      const { criteria } = await extractShowCriteria("a show");

      expect(criteria.keywords).toEqual(["mellow"]);
    });

    it("drops words too short or too long to be useful", async () => {
      respondWith({
        genres: [],
        keywords: ["a", "up", "loud", "x".repeat(30)],
      });

      const { criteria } = await extractShowCriteria("a show");

      expect(criteria.keywords).toEqual(["loud"]);
    });

    it("caps the number of keywords", async () => {
      respondWith({
        genres: [],
        keywords: ["one", "two", "three", "four", "five", "six", "seven"],
      });

      const { criteria } = await extractShowCriteria("a show");

      expect(criteria.keywords).toHaveLength(5);
    });
  });

  describe("the smallest draw bucket", () => {
    // Every band clears "at least 0-25", so it filters nothing but would still
    // score points and show a misleading "draws up to 25" chip in the UI.
    // Models reach for it whenever a description merely sounds small.
    it("is treated as no constraint at all", async () => {
      respondWith({ genres: [], minDraw: DRAW_ORDER[0], keywords: [] });

      const { criteria } = await extractShowCriteria("quiet sunday brunch");

      expect(criteria.minDraw).toBeNull();
    });

    it("keeps every larger bucket", async () => {
      for (const bucket of DRAW_ORDER.slice(1)) {
        respondWith({ genres: [], minDraw: bucket, keywords: [] });
        const { criteria } = await extractShowCriteria("a show");
        expect(criteria.minDraw).toBe(bucket);
      }
    });
  });
});

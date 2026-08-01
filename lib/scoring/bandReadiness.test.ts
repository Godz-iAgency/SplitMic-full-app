import { describe, it, expect } from "vitest";
import { computeBandReadiness, type BandScoreInput } from "./bandReadiness";

/** A band that scores 0 on every criterion — the "just signed up" baseline. */
const EMPTY: BandScoreInput = {
  bio: null,
  instagram_followers: null,
  hasAvatar: false,
  genres: null,
  sound_description: null,
  set_length_minutes: null,
  email_list_size: null,
  typical_draw: null,
  largest_venue_capacity: null,
  tiktok_followers: null,
  youtube_followers: null,
};

/** Every criterion maxed. */
const PERFECT: BandScoreInput = {
  bio: "Austin reggae act.",
  instagram_followers: 10000,
  hasAvatar: true,
  genres: ["Reggae"],
  sound_description: "Roots reggae with a horn section.",
  set_length_minutes: 45,
  email_list_size: 1000,
  typical_draw: "200+",
  largest_venue_capacity: "300-1000",
  tiktok_followers: 25000,
  youtube_followers: 0,
};

describe("computeBandReadiness", () => {
  it("scores an empty profile at 0", () => {
    const result = computeBandReadiness(EMPTY);
    expect(result.score).toBe(0);
    expect(result.max).toBe(10);
  });

  it("scores a fully filled profile at 10", () => {
    expect(computeBandReadiness(PERFECT).score).toBe(10);
  });

  it("never exceeds the maximum, even with absurd inputs", () => {
    const result = computeBandReadiness({
      ...PERFECT,
      instagram_followers: 99_000_000,
      email_list_size: 99_000_000,
      tiktok_followers: 99_000_000,
      youtube_followers: 99_000_000,
    });
    expect(result.score).toBe(10);
  });

  it("returns a score rounded to one decimal, never float noise", () => {
    // 3 of 5 completeness items = 1.2 exactly; the guard is against 1.2000001.
    const result = computeBandReadiness({
      ...EMPTY,
      bio: "A bio.",
      genres: ["Rock"],
      sound_description: "Loud.",
    });
    expect(result.score).toBe(1.2);
  });

  it("gives partial credit for a partly filled profile", () => {
    const result = computeBandReadiness({ ...EMPTY, bio: "A bio." });
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(10);
  });

  describe("typical draw", () => {
    // The bucket → points ladder talent buyers care most about.
    const cases: [string, number][] = [
      ["0-25", 0],
      ["25-75", 0.5],
      ["75-200", 1.5],
      ["200+", 2],
    ];

    it.each(cases)("scores draw bucket %s at %s points", (bucket, points) => {
      const result = computeBandReadiness({ ...EMPTY, typical_draw: bucket });
      expect(criterion(result, "draw").points).toBe(points);
    });

    it("scores an unrecognized bucket as 0 rather than throwing", () => {
      const result = computeBandReadiness({
        ...EMPTY,
        typical_draw: "not-a-real-bucket",
      });
      expect(criterion(result, "draw").points).toBe(0);
      expect(result.score).toBe(0);
    });
  });

  describe("advice text", () => {
    it("is empty for a maxed criterion and present otherwise", () => {
      const maxed = criterion(computeBandReadiness(PERFECT), "draw");
      expect(maxed.points).toBe(maxed.max);
      expect(maxed.advice).toBe("");

      const unmaxed = criterion(
        computeBandReadiness({ ...EMPTY, typical_draw: "25-75" }),
        "draw",
      );
      expect(unmaxed.advice).not.toBe("");
    });

    it("names every missing profile essential", () => {
      const { advice } = criterion(computeBandReadiness(EMPTY), "completeness");
      for (const missing of [
        "a bio",
        "your genres",
        "a sound description",
        "your set length",
        "a profile photo",
      ]) {
        expect(advice).toContain(missing);
      }
    });
  });

  describe("TikTok / YouTube reach", () => {
    it("scores on the stronger of the two platforms", () => {
      const tiktokStrong = computeBandReadiness({
        ...EMPTY,
        tiktok_followers: 25000,
        youtube_followers: 10,
      });
      const youtubeStrong = computeBandReadiness({
        ...EMPTY,
        tiktok_followers: 10,
        youtube_followers: 25000,
      });
      expect(criterion(tiktokStrong, "secondary_social").points).toBe(1.5);
      expect(criterion(youtubeStrong, "secondary_social").points).toBe(1.5);
    });

    it("names the stronger platform in the detail line", () => {
      const result = computeBandReadiness({
        ...EMPTY,
        tiktok_followers: 10,
        youtube_followers: 25000,
      });
      expect(criterion(result, "secondary_social").detail).toContain("YouTube");
    });
  });

  it("reports every criterion, with points never above that criterion's max", () => {
    const result = computeBandReadiness(PERFECT);
    expect(result.criteria.map((c) => c.key)).toEqual([
      "completeness",
      "draw",
      "instagram",
      "email",
      "venue",
      "secondary_social",
    ]);
    for (const c of result.criteria) {
      expect(c.points).toBeLessThanOrEqual(c.max);
      expect(c.points).toBeGreaterThanOrEqual(0);
    }
  });

  it("has criterion maximums that add up to the advertised total of 10", () => {
    const result = computeBandReadiness(EMPTY);
    const total = result.criteria.reduce((sum, c) => sum + c.max, 0);
    expect(total).toBe(10);
  });
});

function criterion(
  result: ReturnType<typeof computeBandReadiness>,
  key: string,
) {
  const found = result.criteria.find((c) => c.key === key);
  if (!found) throw new Error(`No criterion with key "${key}"`);
  return found;
}

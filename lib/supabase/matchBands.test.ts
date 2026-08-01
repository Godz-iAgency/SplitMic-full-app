import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { matchBands, MATCH_LIMIT } from "./matchBands";
import { EMPTY_CRITERIA, type ShowCriteria } from "@/lib/ai/showMatch";

// ── Fake Supabase client ────────────────────────────────────────────────────
// matchBands issues three reads (profiles, band_details, profile_media) and one
// storage URL lookup. Rather than mock a database, this returns canned rows per
// table so the tests are purely about the ranking decisions.

type ProfileRow = { id: string; bio: string | null; instagram_followers: number | null };
type DetailRow = Record<string, unknown> & { profile_id: string };
type MediaRow = { profile_id: string; storage_path: string };

function fakeSupabase(tables: {
  profiles: ProfileRow[];
  band_details: DetailRow[];
  profile_media?: MediaRow[];
}): SupabaseClient {
  const data: Record<string, unknown[]> = {
    profiles: tables.profiles,
    band_details: tables.band_details,
    profile_media: tables.profile_media ?? [],
  };

  // Every query method returns the same chainable object, which is awaitable at
  // any point — matchBands ends its chains on .limit() and .in().
  const chain = (table: string) => {
    const self: Record<string, unknown> = {
      then: (resolve: (value: { data: unknown[] }) => unknown) =>
        resolve({ data: data[table] ?? [] }),
    };
    for (const method of ["select", "eq", "in", "limit", "order"]) {
      self[method] = () => self;
    }
    return self;
  };

  return {
    from: (table: string) => chain(table),
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://cdn.test/${path}` },
        }),
      }),
    },
  } as unknown as SupabaseClient;
}

// ── Test fixtures ───────────────────────────────────────────────────────────

function band(
  id: string,
  detail: Partial<DetailRow> = {},
  profile: Partial<ProfileRow> = {},
) {
  return {
    profile: {
      id,
      bio: null,
      instagram_followers: null,
      ...profile,
    } as ProfileRow,
    detail: {
      profile_id: id,
      band_name: id,
      genres: [],
      sound_description: null,
      member_count: null,
      typical_draw: null,
      set_length_minutes: null,
      email_list_size: null,
      largest_venue_capacity: null,
      tiktok_followers: null,
      youtube_followers: null,
      ...detail,
    } as DetailRow,
  };
}

function clientFor(bands: ReturnType<typeof band>[], media: MediaRow[] = []) {
  return fakeSupabase({
    profiles: bands.map((b) => b.profile),
    band_details: bands.map((b) => b.detail),
    profile_media: media,
  });
}

function criteria(overrides: Partial<ShowCriteria> = {}): ShowCriteria {
  return { ...EMPTY_CRITERIA, ...overrides };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("matchBands", () => {
  it("returns nothing when there are no published bands", async () => {
    const result = await matchBands(clientFor([]), criteria({ genres: ["Rock"] }));
    expect(result).toEqual([]);
  });

  it("skips a profile whose band never filled in its details", async () => {
    const client = fakeSupabase({
      profiles: [{ id: "ghost", bio: null, instagram_followers: null }],
      band_details: [],
    });

    expect(await matchBands(client, criteria())).toEqual([]);
  });

  describe("genre as a gate", () => {
    // Regression: a buyer asking for "solo acoustic brunch" was getting 5-piece
    // reggae bands, because clearing the crowd threshold alone was enough to
    // place. Genre is the most explicit signal a buyer gives — miss it and
    // you're not a match, however well you do on everything else.
    it("excludes a band that plays none of the requested genres", async () => {
      const client = clientFor([
        band("reggae-act", { genres: ["Reggae"], typical_draw: "200+" }),
      ]);

      const result = await matchBands(
        client,
        criteria({ genres: ["Acoustic"], minDraw: "75-200" }),
      );

      expect(result).toEqual([]);
    });

    it("includes a band matching only one of several requested genres", async () => {
      const client = clientFor([band("a", { genres: ["Reggae"] })]);

      const result = await matchBands(
        client,
        criteria({ genres: ["Reggae", "Ska", "Punk"] }),
      );

      expect(result).toHaveLength(1);
    });

    it("does not gate on genre when the buyer named none", async () => {
      const client = clientFor([
        band("a", { genres: ["Reggae"], sound_description: "Positive vibes" }),
      ]);

      const result = await matchBands(client, criteria({ keywords: ["positive"] }));

      expect(result).toHaveLength(1);
    });
  });

  describe("ranking", () => {
    it("puts more genre matches first, even over a more complete profile", async () => {
      const client = clientFor([
        // Perfectly complete, but only one genre in common.
        band(
          "one-genre",
          {
            genres: ["Reggae"],
            sound_description: "Roots reggae.",
            set_length_minutes: 45,
            typical_draw: "200+",
            largest_venue_capacity: "300-1000",
            email_list_size: 1000,
            tiktok_followers: 25000,
          },
          { bio: "A bio.", instagram_followers: 10000 },
        ),
        // Bare profile, but two genres in common.
        band("two-genres", { genres: ["Reggae", "Ska"] }),
      ]);

      const result = await matchBands(
        client,
        criteria({ genres: ["Reggae", "Ska"] }),
      );

      expect(result.map((c) => c.profile_id)).toEqual(["two-genres", "one-genre"]);
    });

    it("breaks ties between equal matches using profile completeness", async () => {
      const client = clientFor([
        band("sparse", { genres: ["Reggae"] }),
        band(
          "complete",
          {
            genres: ["Reggae"],
            sound_description: "Roots reggae.",
            set_length_minutes: 45,
            typical_draw: "200+",
          },
          { bio: "A bio.", instagram_followers: 10000 },
        ),
      ]);

      const result = await matchBands(client, criteria({ genres: ["Reggae"] }));

      expect(result.map((c) => c.profile_id)).toEqual(["complete", "sparse"]);
    });

    it("ranks by profile completeness alone when there are no criteria", async () => {
      const client = clientFor([
        band("sparse", { genres: ["Reggae"] }),
        band(
          "complete",
          {
            genres: ["Reggae"],
            sound_description: "Roots reggae.",
            set_length_minutes: 45,
            typical_draw: "200+",
          },
          { bio: "A bio.", instagram_followers: 10000 },
        ),
      ]);

      // This is the Gemini-is-down path: no criteria, everyone still shows.
      const result = await matchBands(client, EMPTY_CRITERIA);

      expect(result.map((c) => c.profile_id)).toEqual(["complete", "sparse"]);
    });

    it("caps the shortlist", async () => {
      const many = Array.from({ length: MATCH_LIMIT + 8 }, (_, i) =>
        band(`band-${i}`, { genres: ["Reggae"] }),
      );

      const result = await matchBands(clientFor(many), criteria({ genres: ["Reggae"] }));

      expect(result).toHaveLength(MATCH_LIMIT);
    });
  });

  describe("draw threshold", () => {
    it("rewards a band that clears it", async () => {
      const client = clientFor([
        band("big", { genres: ["Reggae"], typical_draw: "200+" }),
        band("small", { genres: ["Reggae"], typical_draw: "25-75" }),
      ]);

      const result = await matchBands(
        client,
        criteria({ genres: ["Reggae"], minDraw: "75-200" }),
      );

      expect(result.map((c) => c.profile_id)).toEqual(["big", "small"]);
      expect(result[0].reasons).toContain("Draws 200 or more");
    });

    it("keeps a band below the threshold when its genre still matches", async () => {
      const client = clientFor([
        band("small", { genres: ["Reggae"], typical_draw: "0-25" }),
      ]);

      const result = await matchBands(
        client,
        criteria({ genres: ["Reggae"], minDraw: "200+" }),
      );

      expect(result).toHaveLength(1);
      expect(result[0].reasons).toEqual(["Plays Reggae"]);
    });

    it("does not credit a band that never stated its draw", async () => {
      const client = clientFor([band("unknown", { genres: ["Reggae"], typical_draw: null })]);

      const result = await matchBands(
        client,
        criteria({ genres: ["Reggae"], minDraw: "25-75" }),
      );

      expect(result[0].reasons).toEqual(["Plays Reggae"]);
    });
  });

  describe("band size", () => {
    it("rewards a band within the requested size", async () => {
      const client = clientFor([band("duo", { genres: ["Folk"], member_count: 2 })]);

      const result = await matchBands(
        client,
        criteria({ genres: ["Folk"], maxMemberCount: 3 }),
      );

      expect(result[0].reasons).toContain("2-piece");
    });

    it("calls a one-person act a solo act", async () => {
      const client = clientFor([band("solo", { genres: ["Folk"], member_count: 1 })]);

      const result = await matchBands(
        client,
        criteria({ genres: ["Folk"], maxMemberCount: 1 }),
      );

      expect(result[0].reasons).toContain("Solo act");
    });

    it("gives no size credit to a band over the limit", async () => {
      const client = clientFor([band("big", { genres: ["Folk"], member_count: 9 })]);

      const result = await matchBands(
        client,
        criteria({ genres: ["Folk"], maxMemberCount: 2 }),
      );

      expect(result[0].reasons).toEqual(["Plays Folk"]);
    });
  });

  describe("vibe keywords", () => {
    it("matches against the band's own sound description, case-insensitively", async () => {
      const client = clientFor([
        band("a", { genres: [], sound_description: "Positive VIBES from Jamaica" }),
      ]);

      const result = await matchBands(client, criteria({ keywords: ["positive"] }));

      expect(result[0].reasons).toContain("Describes their sound as positive");
    });

    it("excludes a band with no keyword match when that's the only criterion", async () => {
      const client = clientFor([
        band("a", { genres: [], sound_description: "Loud and fast" }),
      ]);

      const result = await matchBands(client, criteria({ keywords: ["mellow"] }));

      expect(result).toEqual([]);
    });
  });

  describe("card contents", () => {
    it("builds a public avatar URL when the band has one", async () => {
      const client = clientFor(
        [band("a", { genres: ["Reggae"] })],
        [{ profile_id: "a", storage_path: "user/avatar.jpg" }],
      );

      const result = await matchBands(client, criteria({ genres: ["Reggae"] }));

      expect(result[0].avatar_url).toBe("https://cdn.test/user/avatar.jpg");
    });

    it("leaves the avatar null when the band has none", async () => {
      const client = clientFor([band("a", { genres: ["Reggae"] })]);

      const result = await matchBands(client, criteria({ genres: ["Reggae"] }));

      expect(result[0].avatar_url).toBeNull();
    });

    it("falls back to a placeholder name rather than showing nothing", async () => {
      const client = clientFor([band("a", { genres: ["Reggae"], band_name: null })]);

      const result = await matchBands(client, criteria({ genres: ["Reggae"] }));

      expect(result[0].display_name).toBe("Unnamed band");
    });

    it("lists every matched criterion as a reason", async () => {
      const client = clientFor([
        band("a", {
          genres: ["Reggae", "Ska"],
          typical_draw: "200+",
          member_count: 4,
          sound_description: "Upbeat party band",
        }),
      ]);

      const result = await matchBands(
        client,
        criteria({
          genres: ["Reggae", "Ska"],
          minDraw: "75-200",
          maxMemberCount: 5,
          keywords: ["upbeat"],
        }),
      );

      expect(result[0].reasons).toEqual([
        "Plays Reggae and Ska",
        "Draws 200 or more",
        "4-piece",
        "Describes their sound as upbeat",
      ]);
    });
  });
});

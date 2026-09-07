import { describe, it, expect } from "vitest";
import {
  buildSocialLinks,
  socialValuesFromLinks,
  EMPTY_SOCIAL_VALUES,
  SOCIAL_PLATFORMS,
  type SocialValues,
} from "./socialLinks";

const PROFILE_ID = "profile-1";

function values(overrides: Partial<SocialValues> = {}): SocialValues {
  return { ...EMPTY_SOCIAL_VALUES, ...overrides };
}

describe("buildSocialLinks", () => {
  it("returns no rows when nothing is filled in", () => {
    expect(buildSocialLinks(PROFILE_ID, values())).toEqual([]);
  });

  it("expands a bare handle into a full URL", () => {
    const links = buildSocialLinks(PROFILE_ID, values({ tiktok_handle: "yourband" }));
    expect(links).toEqual([
      { profile_id: PROFILE_ID, platform: "tiktok", url: "https://tiktok.com/@yourband" },
    ]);
  });

  it("strips a leading @ before expanding", () => {
    const links = buildSocialLinks(PROFILE_ID, values({ twitter_handle: "@splitmicatx" }));
    expect(links[0].url).toBe("https://x.com/splitmicatx");
  });

  it("keeps a pasted full URL as-is rather than double-prefixing it", () => {
    const links = buildSocialLinks(
      PROFILE_ID,
      values({ tiktok_handle: "https://tiktok.com/@yourband" }),
    );
    expect(links[0].url).toBe("https://tiktok.com/@yourband");
  });

  it("never emits an instagram row, since it lives on its own column", () => {
    // The regression this guards: instagram_handle is a real column on
    // `profiles`, read by search and the readiness score. Writing it as a
    // profile_links row too would create a second, silently diverging copy.
    const links = buildSocialLinks(PROFILE_ID, values({ instagram_handle: "splitmicatx" }));
    expect(links).toEqual([]);
  });

  it("skips a platform whose value was cleared", () => {
    // Deselecting a chip clears the value; that must remove the link, because
    // saving deletes every existing row before inserting these.
    const links = buildSocialLinks(
      PROFILE_ID,
      values({ facebook_url: "   ", spotify_artist_url: "https://open.spotify.com/artist/x" }),
    );
    expect(links.map((l) => l.platform)).toEqual(["spotify"]);
  });
});

describe("socialValuesFromLinks", () => {
  it("reads instagram from the profiles column, not from links", () => {
    const result = socialValuesFromLinks([], "splitmicatx");
    expect(result.instagram_handle).toBe("splitmicatx");
  });

  it("returns empty values for a profile with no links at all", () => {
    expect(socialValuesFromLinks([], null)).toEqual(EMPTY_SOCIAL_VALUES);
  });

  it("turns a stored URL back into the bare handle the input shows", () => {
    const result = socialValuesFromLinks(
      [{ platform: "twitter", url: "https://x.com/splitmicatx" }],
      null,
    );
    expect(result.twitter_handle).toBe("splitmicatx");
  });

  it("survives a round trip without losing or mangling any platform", () => {
    // This is the data-loss guard. /profile/edit hydrates from these values and
    // then saves with a delete-then-insert, so anything this fails to read back
    // is a link the user's next save would silently delete.
    const original = values({
      instagram_handle: "splitmicatx",
      tiktok_handle: "yourband",
      youtube_channel_url: "https://youtube.com/@yourband",
      spotify_artist_url: "https://open.spotify.com/artist/abc",
      facebook_url: "https://facebook.com/yourband",
      twitter_handle: "splitmicatx",
    });

    const links = buildSocialLinks(PROFILE_ID, original);
    const restored = socialValuesFromLinks(
      links.map((l) => ({ platform: l.platform, url: l.url })),
      original.instagram_handle,
    );

    expect(restored).toEqual(original);
  });

  it("covers every platform the picker can show", () => {
    // If a platform is added to SOCIAL_PLATFORMS without a working fromUrl,
    // the round trip above would silently stop covering it.
    const linkPlatforms = SOCIAL_PLATFORMS.filter((p) => p.toUrl !== null);
    expect(linkPlatforms.length).toBe(SOCIAL_PLATFORMS.length - 1);
    expect(SOCIAL_PLATFORMS.map((p) => p.id)).toContain("instagram");
  });
});

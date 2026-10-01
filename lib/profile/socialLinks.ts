/**
 * The one definition of "which social platforms SplitMic knows about", how each
 * one's stored value maps to a URL, and how it maps back.
 *
 * This exists because the link-building logic was previously duplicated
 * verbatim in OnboardingFlow.tsx and app/profile/edit/actions.ts. Both write to
 * `profile_links` with a delete-then-insert, so the two copies drifting apart
 * would silently drop a user's links on whichever path was behind.
 *
 * Instagram is deliberately the odd one out: it is stored on
 * `profiles.instagram_handle` (a real column, read by the profile page and the
 * admin views) rather than as a `profile_links` row. It still appears in the picker
 * alongside the others because that distinction is a storage detail nobody
 * filling in a form should have to think about.
 */

export type SocialPlatformId =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "spotify"
  | "facebook"
  | "twitter";

/**
 * Social fields carried on CommonFieldValues. Every player type has these:
 * a venue has an Instagram and a Facebook page exactly like a band does, which
 * is why these are common fields rather than band-only ones.
 */
export type SocialValues = {
  instagram_handle: string;
  tiktok_handle: string;
  youtube_channel_url: string;
  spotify_artist_url: string;
  facebook_url: string;
  twitter_handle: string;
};

export const EMPTY_SOCIAL_VALUES: SocialValues = {
  instagram_handle: "",
  tiktok_handle: "",
  youtube_channel_url: "",
  spotify_artist_url: "",
  facebook_url: "",
  twitter_handle: "",
};

type PlatformConfig = {
  id: SocialPlatformId;
  /** Chip text. */
  label: string;
  field: keyof SocialValues;
  inputLabel: string;
  placeholder: string;
  hint?: string;
  /**
   * Stored value to a full URL for `profile_links`. Null for Instagram, which
   * lives on its own column and never becomes a link row.
   */
  toUrl: ((value: string) => string) | null;
  /** A `profile_links` URL back to the value the input shows. */
  fromUrl: (url: string) => string;
};

/** A pasted full URL is always kept as-is; only a bare handle gets expanded. */
function handleToUrl(base: string) {
  return (value: string) => {
    const handle = value.trim().replace(/^@/, "");
    return handle.startsWith("http") ? handle : `${base}${handle}`;
  };
}

export const SOCIAL_PLATFORMS: PlatformConfig[] = [
  {
    id: "instagram",
    label: "Instagram",
    field: "instagram_handle",
    inputLabel: "Instagram handle",
    placeholder: "splitmicatx",
    hint: "Without the @",
    toUrl: null,
    fromUrl: (url) => url.replace(/^https?:\/\/(www\.)?instagram\.com\/@?/, ""),
  },
  {
    id: "tiktok",
    label: "TikTok",
    field: "tiktok_handle",
    inputLabel: "TikTok handle",
    placeholder: "yourband",
    hint: "Without the @",
    toUrl: handleToUrl("https://tiktok.com/@"),
    fromUrl: (url) => url.replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, ""),
  },
  {
    id: "youtube",
    label: "YouTube",
    field: "youtube_channel_url",
    inputLabel: "YouTube channel",
    placeholder: "https://youtube.com/@yourband",
    toUrl: (value) => value.trim(),
    fromUrl: (url) => url,
  },
  {
    id: "spotify",
    label: "Spotify",
    field: "spotify_artist_url",
    inputLabel: "Spotify artist page",
    placeholder: "https://open.spotify.com/artist/...",
    toUrl: (value) => value.trim(),
    fromUrl: (url) => url,
  },
  {
    id: "facebook",
    label: "Facebook",
    field: "facebook_url",
    inputLabel: "Facebook page",
    placeholder: "https://facebook.com/yourband",
    toUrl: (value) => value.trim(),
    fromUrl: (url) => url,
  },
  {
    id: "twitter",
    label: "X",
    field: "twitter_handle",
    inputLabel: "X / Twitter handle",
    placeholder: "splitmicatx",
    hint: "Without the @",
    toUrl: handleToUrl("https://x.com/"),
    fromUrl: (url) => url.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\/@?/, ""),
  },
];

export type ProfileLinkRow = {
  profile_id: string;
  platform: string;
  url: string;
};

/**
 * Rows for `profile_links`. Instagram is skipped (it has its own column), and
 * an empty value produces no row at all, so deselecting a platform in the
 * picker genuinely removes the link rather than storing a blank one.
 */
export function buildSocialLinks(
  profileId: string,
  values: SocialValues,
): ProfileLinkRow[] {
  const rows: ProfileLinkRow[] = [];

  for (const platform of SOCIAL_PLATFORMS) {
    if (!platform.toUrl) continue;
    const raw = values[platform.field]?.trim();
    if (!raw) continue;
    rows.push({
      profile_id: profileId,
      platform: platform.id,
      url: platform.toUrl(raw),
    });
  }

  return rows;
}

/**
 * The inverse, for rehydrating the edit form. `instagramHandle` comes from the
 * profiles row rather than the links list.
 *
 * Getting this wrong is expensive rather than merely wrong: saving does a
 * delete-then-insert of every link, so a value that fails to load here is a
 * value the next save deletes.
 */
export function socialValuesFromLinks(
  links: { platform: string; url: string }[],
  instagramHandle: string | null,
): SocialValues {
  const values: SocialValues = { ...EMPTY_SOCIAL_VALUES };
  values.instagram_handle = instagramHandle ?? "";

  for (const platform of SOCIAL_PLATFORMS) {
    if (!platform.toUrl) continue;
    const match = links.find((l) => l.platform === platform.id);
    if (match?.url) values[platform.field] = platform.fromUrl(match.url);
  }

  return values;
}

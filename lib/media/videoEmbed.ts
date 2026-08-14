/**
 * Turns a pasted video link into an embeddable iframe URL.
 *
 * Replaces the old "upload a 30-second clip to Supabase Storage" flow: users
 * paste a link to a video they already have online, and it plays inside the
 * profile page instead of sending the visitor off to another site.
 *
 * ── Why an allowlist, and not "iframe whatever they paste" ──────────────────
 * Two independent reasons:
 *
 *  1. It wouldn't work anyway. A site can refuse to be framed
 *     (X-Frame-Options / frame-ancestors), and most big ones do — Instagram,
 *     TikTok, and Facebook all block it. A generic iframe would render a blank
 *     box with no explanation, which reads as "the app is broken."
 *
 *  2. It would be a phishing vector. Profiles are public and user-controlled,
 *     so an arbitrary iframe lets anyone embed a page of their choosing that
 *     renders *on splitmic.com* — e.g. a fake SplitMic login form. Visitors
 *     have no way to tell it isn't ours. An allowlist removes that entirely,
 *     and costs nothing real: every actual video platform is covered below.
 *
 * Pure and dependency-free, so it's unit-testable and safe on both the server
 * and the client. Never throws — a malformed URL comes back as a typed
 * failure with a message worth showing the user.
 */

export type VideoProvider =
  | "youtube"
  | "vimeo"
  | "loom"
  | "soundcloud"
  | "spotify"
  | "google_drive"
  | "dropbox"
  | "direct_file";

/**
 * How the embed gets rendered, which is also where the security line sits.
 *
 * `iframe` loads someone else's *page*, which is what makes an open-ended
 * allowlist dangerous — a page can render a convincing fake login form.
 * `file` points a native <video> element at raw media bytes: no HTML, no
 * scripts, nothing that can impersonate SplitMic. So `file` is safe from any
 * host, while `iframe` stays restricted to the platforms named above.
 */
export type EmbedKind = "iframe" | "file";

export type VideoEmbed = {
  provider: VideoProvider;
  /** The `src` — for an iframe, or for a <video> element when kind is "file". */
  embedUrl: string;
  /** Human label for the provider, for aria-labels and helper text. */
  providerLabel: string;
  /** Audio platforms render as a short bar, not a 16:9 video frame. */
  isAudio: boolean;
  kind: EmbedKind;
};

export type VideoEmbedResult =
  | { ok: true; embed: VideoEmbed }
  | { ok: false; reason: string };

const PROVIDER_LABELS: Record<VideoProvider, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  loom: "Loom",
  soundcloud: "SoundCloud",
  spotify: "Spotify",
  google_drive: "Google Drive",
  dropbox: "Dropbox",
  direct_file: "Video file",
};

/**
 * Extensions a browser's native <video> element can plausibly decode. Matched
 * against the path only, so a signed CDN URL with a query string still counts.
 */
const VIDEO_FILE_EXTENSIONS = [".mp4", ".webm", ".m4v", ".mov", ".ogv", ".ogg"];

/**
 * Hosts that are worth naming in the error message. These are common enough
 * that a user pasting one deserves to know *why* it won't work rather than a
 * generic "unsupported link" — they block framing on their end, and there is
 * nothing we can do about it from here.
 */
const KNOWN_BLOCKED: { match: RegExp; name: string }[] = [
  { match: /(^|\.)instagram\.com$/i, name: "Instagram" },
  { match: /(^|\.)tiktok\.com$/i, name: "TikTok" },
  { match: /(^|\.)facebook\.com$/i, name: "Facebook" },
  { match: /(^|\.)x\.com$/i, name: "X" },
  { match: /(^|\.)twitter\.com$/i, name: "Twitter" },
];

const SUPPORTED_LIST =
  "YouTube, Vimeo, Loom, SoundCloud, Spotify, or Google Drive — or a direct link to a video file (.mp4, .webm)";

/**
 * Resolves a user-pasted link to an embed. Accepts a bare host too
 * ("youtu.be/abc123") — people paste without the scheme constantly, and
 * rejecting that would feel broken.
 */
export function resolveVideoEmbed(rawInput: string): VideoEmbedResult {
  const trimmed = rawInput.trim();
  if (!trimmed) return { ok: false, reason: "Paste a video link first." };

  const url = parseUrl(trimmed);
  if (!url) {
    return { ok: false, reason: "That doesn't look like a link. Paste the full URL to your video." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http and https links work here." };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  const youtube = youtubeEmbed(url, host);
  if (youtube) return { ok: true, embed: youtube };

  const vimeo = vimeoEmbed(url, host);
  if (vimeo) return { ok: true, embed: vimeo };

  const loom = loomEmbed(url, host);
  if (loom) return { ok: true, embed: loom };

  const spotify = spotifyEmbed(url, host);
  if (spotify) return { ok: true, embed: spotify };

  const drive = googleDriveEmbed(url, host);
  if (drive) return { ok: true, embed: drive };

  // SoundCloud last: its embed player accepts any soundcloud.com track URL
  // wholesale, so it needs no path parsing and would otherwise shadow nothing.
  const soundcloud = soundcloudEmbed(url, host);
  if (soundcloud) return { ok: true, embed: soundcloud };

  // Dropbox share links serve an HTML preview page, not the file — one query
  // param turns them into the raw file, which then qualifies as a direct file
  // below. Checked before the extension test because the *unrewritten* link
  // already ends in .mp4 and would otherwise be played as-is (and fail).
  const dropboxFile = dropboxDirectUrl(url, host);
  if (dropboxFile) {
    return httpsFileEmbed(dropboxFile, "dropbox");
  }

  if (hasVideoExtension(url.pathname)) {
    return httpsFileEmbed(url, "direct_file");
  }

  const blocked = KNOWN_BLOCKED.find((entry) => entry.match.test(host));
  if (blocked) {
    return {
      ok: false,
      reason: `${blocked.name} blocks its videos from playing on other sites, so this link can't play here. Upload the video to ${SUPPORTED_LIST} and paste that link instead.`,
    };
  }

  return {
    ok: false,
    reason: `Links from ${host} can't play inside SplitMic. Use ${SUPPORTED_LIST}.`,
  };
}

/** True when the input resolves to something embeddable. */
export function isEmbeddableVideoUrl(rawInput: string): boolean {
  return resolveVideoEmbed(rawInput).ok;
}

// ── Per-provider matchers ───────────────────────────────────────────────────

function embed(
  provider: VideoProvider,
  embedUrl: string,
  isAudio = false,
): VideoEmbed {
  return {
    provider,
    embedUrl,
    providerLabel: PROVIDER_LABELS[provider],
    isAudio,
    kind: "iframe",
  };
}

/** True when the path ends in something a <video> element can decode. */
function hasVideoExtension(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return VIDEO_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Builds a direct-file embed, rejecting plain http. The profile page is
 * https, so a browser blocks an http media request as mixed content — the
 * player would silently render an empty box. Better to say why up front.
 */
function httpsFileEmbed(url: URL, provider: VideoProvider): VideoEmbedResult {
  if (url.protocol !== "https:") {
    return {
      ok: false,
      reason:
        "That video link isn't secure (http), so browsers block it from playing on SplitMic. Use an https link.",
    };
  }

  return {
    ok: true,
    embed: {
      provider,
      embedUrl: url.href,
      providerLabel: PROVIDER_LABELS[provider],
      isAudio: false,
      kind: "file",
    },
  };
}

/**
 * Rewrites a Dropbox share link to serve the raw file instead of Dropbox's
 * HTML preview page. Returns null for Dropbox URLs that aren't a video file,
 * so a folder link falls through to the normal unsupported message.
 */
function dropboxDirectUrl(url: URL, host: string): URL | null {
  if (host !== "dropbox.com" && host !== "dl.dropboxusercontent.com") return null;
  if (!hasVideoExtension(url.pathname)) return null;

  const rewritten = new URL(url.href);
  rewritten.searchParams.delete("dl");
  rewritten.searchParams.set("raw", "1");
  return rewritten;
}

/** YouTube IDs are exactly 11 chars of [A-Za-z0-9_-]. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function youtubeEmbed(url: URL, host: string): VideoEmbed | null {
  let id: string | null = null;

  if (host === "youtu.be") {
    id = firstSegment(url.pathname);
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const segments = pathSegments(url.pathname);
    if (segments[0] === "watch") {
      id = url.searchParams.get("v");
    } else if (segments[0] === "shorts" || segments[0] === "embed" || segments[0] === "live") {
      id = segments[1] ?? null;
    }
  }

  if (!id || !YOUTUBE_ID.test(id)) return null;

  // youtube-nocookie: no tracking cookie is set unless the visitor actually
  // plays the video, which keeps a profile page from silently dropping
  // third-party cookies on everyone who loads it.
  return embed("youtube", `https://www.youtube-nocookie.com/embed/${id}`);
}

function vimeoEmbed(url: URL, host: string): VideoEmbed | null {
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;

  const segments = pathSegments(url.pathname);
  // player.vimeo.com/video/123, vimeo.com/123, vimeo.com/channels/staff/123
  const numeric = segments.reverse().find((segment) => /^\d+$/.test(segment));
  if (!numeric) return null;

  return embed("vimeo", `https://player.vimeo.com/video/${numeric}`);
}

function loomEmbed(url: URL, host: string): VideoEmbed | null {
  if (host !== "loom.com") return null;

  const segments = pathSegments(url.pathname);
  // loom.com/share/<id> and loom.com/embed/<id> both carry the id second.
  if (segments[0] !== "share" && segments[0] !== "embed") return null;
  const id = segments[1];
  if (!id || !/^[A-Za-z0-9]+$/.test(id)) return null;

  return embed("loom", `https://www.loom.com/embed/${id}`);
}

const SPOTIFY_TYPES = ["track", "album", "playlist", "artist", "episode", "show"];

function spotifyEmbed(url: URL, host: string): VideoEmbed | null {
  if (host !== "open.spotify.com") return null;

  const segments = pathSegments(url.pathname);
  // Locale-prefixed links exist too: /intl-es/track/<id>
  const typeIndex = segments.findIndex((segment) => SPOTIFY_TYPES.includes(segment));
  if (typeIndex === -1) return null;

  const type = segments[typeIndex];
  const id = segments[typeIndex + 1];
  if (!id || !/^[A-Za-z0-9]+$/.test(id)) return null;

  return embed("spotify", `https://open.spotify.com/embed/${type}/${id}`, true);
}

function soundcloudEmbed(url: URL, host: string): VideoEmbed | null {
  if (host !== "soundcloud.com") return null;
  // A bare profile link has one segment; a track has at least two.
  if (pathSegments(url.pathname).length < 2) return null;

  const target = `https://soundcloud.com${url.pathname}`;
  return embed(
    "soundcloud",
    `https://w.soundcloud.com/player/?url=${encodeURIComponent(target)}&color=%23ff5500&auto_play=false&show_comments=false`,
    true,
  );
}

function googleDriveEmbed(url: URL, host: string): VideoEmbed | null {
  if (host !== "drive.google.com") return null;

  const segments = pathSegments(url.pathname);
  // drive.google.com/file/d/<id>/view
  if (segments[0] !== "file" || segments[1] !== "d") return null;
  const id = segments[2];
  if (!id) return null;

  // Note: this only plays for viewers if the file's sharing is set to
  // "anyone with the link" — the surrounding UI says so, since a private file
  // renders a Google sign-in box rather than the video.
  return embed("google_drive", `https://drive.google.com/file/d/${id}/preview`);
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** Parses a URL, retrying with https:// so bare hosts ("youtu.be/x") work. */
function parseUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    // Only retry things that plausibly start with a host, so a sentence of
    // prose doesn't silently become "https://some words".
    if (!/^[\w-]+(\.[\w-]+)+/.test(input)) return null;
    try {
      return new URL(`https://${input}`);
    } catch {
      return null;
    }
  }
}

function pathSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

function firstSegment(pathname: string): string | null {
  return pathSegments(pathname)[0] ?? null;
}

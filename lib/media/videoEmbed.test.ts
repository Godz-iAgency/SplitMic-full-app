import { describe, it, expect } from "vitest";
import { resolveVideoEmbed, isEmbeddableVideoUrl } from "./videoEmbed";

/** Unwraps a result that's expected to succeed, failing loudly if it didn't. */
function embedOf(input: string) {
  const result = resolveVideoEmbed(input);
  if (!result.ok) throw new Error(`Expected ${input} to resolve, got: ${result.reason}`);
  return result.embed;
}

describe("resolveVideoEmbed", () => {
  describe("YouTube", () => {
    it("resolves a standard watch link", () => {
      expect(embedOf("https://www.youtube.com/watch?v=dQw4w9WgXcQ").embedUrl).toBe(
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      );
    });

    it("resolves a youtu.be short link", () => {
      expect(embedOf("https://youtu.be/dQw4w9WgXcQ").embedUrl).toContain("/embed/dQw4w9WgXcQ");
    });

    it("resolves a Shorts link", () => {
      expect(embedOf("https://www.youtube.com/shorts/dQw4w9WgXcQ").embedUrl).toContain(
        "/embed/dQw4w9WgXcQ",
      );
    });

    it("resolves an already-embed link without double-wrapping it", () => {
      expect(embedOf("https://www.youtube.com/embed/dQw4w9WgXcQ").embedUrl).toBe(
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      );
    });

    it("ignores trailing params like a timestamp", () => {
      expect(embedOf("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s").embedUrl).toBe(
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      );
    });

    it("accepts a link pasted without the scheme", () => {
      expect(embedOf("youtu.be/dQw4w9WgXcQ").provider).toBe("youtube");
    });

    it("rejects a YouTube URL with no video id", () => {
      expect(resolveVideoEmbed("https://www.youtube.com/").ok).toBe(false);
    });

    it("rejects a malformed video id rather than embedding a broken player", () => {
      // Real ids are exactly 11 chars; anything else is a typo or a channel URL.
      expect(resolveVideoEmbed("https://www.youtube.com/watch?v=tooshort").ok).toBe(false);
    });

    it("uses the no-cookie host so a profile view drops no tracking cookie", () => {
      expect(embedOf("https://youtu.be/dQw4w9WgXcQ").embedUrl).toContain("youtube-nocookie.com");
    });
  });

  describe("Vimeo", () => {
    it("resolves a plain vimeo link", () => {
      expect(embedOf("https://vimeo.com/123456789").embedUrl).toBe(
        "https://player.vimeo.com/video/123456789",
      );
    });

    it("resolves a channel-nested link", () => {
      expect(embedOf("https://vimeo.com/channels/staffpicks/123456789").embedUrl).toBe(
        "https://player.vimeo.com/video/123456789",
      );
    });

    it("resolves an existing player link", () => {
      expect(embedOf("https://player.vimeo.com/video/123456789").embedUrl).toBe(
        "https://player.vimeo.com/video/123456789",
      );
    });

    it("rejects a vimeo profile link with no video id", () => {
      expect(resolveVideoEmbed("https://vimeo.com/someuser").ok).toBe(false);
    });
  });

  describe("Loom", () => {
    it("resolves a share link", () => {
      expect(embedOf("https://www.loom.com/share/abc123def456").embedUrl).toBe(
        "https://www.loom.com/embed/abc123def456",
      );
    });

    it("rejects a loom link that isn't a share/embed", () => {
      expect(resolveVideoEmbed("https://www.loom.com/looms/videos").ok).toBe(false);
    });
  });

  describe("Spotify", () => {
    it("resolves a track", () => {
      expect(embedOf("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT").embedUrl).toBe(
        "https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT",
      );
    });

    it("resolves an album", () => {
      expect(embedOf("https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3").embedUrl).toContain(
        "/embed/album/",
      );
    });

    it("resolves a locale-prefixed link", () => {
      expect(embedOf("https://open.spotify.com/intl-es/track/4cOdK2wGLETKBW3PvgPWqT").embedUrl).toBe(
        "https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT",
      );
    });

    it("marks Spotify as audio so the UI renders a bar, not a 16:9 frame", () => {
      expect(embedOf("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT").isAudio).toBe(true);
    });

    it("strips query params from the embed URL", () => {
      const url = embedOf(
        "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc123",
      ).embedUrl;
      expect(url).not.toContain("si=");
    });
  });

  describe("SoundCloud", () => {
    it("resolves a track link into the widget player", () => {
      const url = embedOf("https://soundcloud.com/artist/track-name").embedUrl;
      expect(url).toContain("w.soundcloud.com/player");
      expect(url).toContain(encodeURIComponent("https://soundcloud.com/artist/track-name"));
    });

    it("rejects a bare profile link with no track", () => {
      expect(resolveVideoEmbed("https://soundcloud.com/artist").ok).toBe(false);
    });

    it("marks SoundCloud as audio", () => {
      expect(embedOf("https://soundcloud.com/artist/track-name").isAudio).toBe(true);
    });
  });

  describe("Google Drive", () => {
    it("converts a share link into a preview link", () => {
      expect(embedOf("https://drive.google.com/file/d/1AbC_dEf/view?usp=sharing").embedUrl).toBe(
        "https://drive.google.com/file/d/1AbC_dEf/preview",
      );
    });

    it("rejects a Drive folder link", () => {
      expect(resolveVideoEmbed("https://drive.google.com/drive/folders/1AbC").ok).toBe(false);
    });
  });

  describe("direct video files (any host)", () => {
    // These are allowed from anywhere, unlike the iframe providers, because a
    // <video> element renders media bytes — it cannot render a page, so the
    // fake-login-form risk that motivates the allowlist doesn't exist here.
    it.each([".mp4", ".webm", ".m4v", ".mov", ".ogv"])(
      "accepts a %s file from an arbitrary host",
      (ext) => {
        const result = embedOf(`https://cdn.somebodys-site.com/clips/intro${ext}`);
        expect(result.provider).toBe("direct_file");
        expect(result.kind).toBe("file");
      },
    );

    it("renders as a file, never as an iframe", () => {
      // The security property that makes arbitrary hosts acceptable.
      expect(embedOf("https://evil.example.com/clip.mp4").kind).toBe("file");
    });

    it("keeps a signed CDN query string intact", () => {
      const url = "https://cdn.example.com/clip.mp4?token=abc123&expires=999";
      expect(embedOf(url).embedUrl).toBe(url);
    });

    it("matches the extension case-insensitively", () => {
      expect(embedOf("https://cdn.example.com/CLIP.MP4").kind).toBe("file");
    });

    it("rejects a non-video file", () => {
      expect(resolveVideoEmbed("https://example.com/deck.pdf").ok).toBe(false);
    });

    it("rejects an http file link, explaining that browsers block it", () => {
      // Mixed content on an https page: it would render an empty player, so
      // failing loudly beats failing silently.
      const result = resolveVideoEmbed("http://cdn.example.com/clip.mp4");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain("https");
    });

    it("still refuses an arbitrary HTML page from the same host", () => {
      // Allowing files from any host must not widen the iframe allowlist.
      expect(resolveVideoEmbed("https://cdn.somebodys-site.com/login").ok).toBe(false);
    });
  });

  describe("Dropbox", () => {
    it("rewrites a share link to serve the raw file", () => {
      const result = embedOf("https://www.dropbox.com/s/abc123/intro.mp4?dl=0");
      expect(result.provider).toBe("dropbox");
      expect(result.kind).toBe("file");
      expect(result.embedUrl).toContain("raw=1");
      expect(result.embedUrl).not.toContain("dl=0");
    });

    it("handles the newer /scl/fi share format", () => {
      const result = embedOf(
        "https://www.dropbox.com/scl/fi/xyz/intro.mp4?rlkey=abc&dl=0",
      );
      expect(result.kind).toBe("file");
      expect(result.embedUrl).toContain("rlkey=abc");
      expect(result.embedUrl).toContain("raw=1");
    });

    it("rejects a Dropbox folder link that isn't a video", () => {
      expect(resolveVideoEmbed("https://www.dropbox.com/home/videos").ok).toBe(false);
    });
  });

  describe("links that cannot work", () => {
    it.each([
      ["https://www.instagram.com/reel/abc123/", "Instagram"],
      ["https://www.tiktok.com/@user/video/123", "TikTok"],
      ["https://www.facebook.com/watch/?v=123", "Facebook"],
    ])("names %s explicitly instead of failing vaguely", (url, name) => {
      const result = resolveVideoEmbed(url);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain(name);
        // The point of naming it: tell them what to do next, not just "no".
        expect(result.reason).toContain("YouTube");
      }
    });

    it("rejects an arbitrary page rather than iframing it", () => {
      // Not a capability gap — embedding attacker-chosen pages on a public
      // profile is a phishing vector (a fake login form rendered on our own
      // domain). The allowlist is the mitigation. Note the contrast with the
      // direct-file tests above: the same host IS allowed to serve a .mp4,
      // because media bytes can't impersonate anything.
      const result = resolveVideoEmbed("https://evil.example.com/fake-login");
      expect(result.ok).toBe(false);
    });

    it("rejects a javascript: URL", () => {
      expect(resolveVideoEmbed("javascript:alert(1)").ok).toBe(false);
    });

    it("rejects a data: URL", () => {
      expect(resolveVideoEmbed("data:text/html,<h1>hi</h1>").ok).toBe(false);
    });

    it("rejects empty input with a nudge rather than a scary error", () => {
      const result = resolveVideoEmbed("   ");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain("Paste");
    });

    it("rejects prose that isn't a link at all", () => {
      expect(resolveVideoEmbed("my video is on youtube somewhere").ok).toBe(false);
    });
  });
});

describe("isEmbeddableVideoUrl", () => {
  it("is true for a supported link", () => {
    expect(isEmbeddableVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  it("is true for a direct video file on any host", () => {
    expect(isEmbeddableVideoUrl("https://example.com/video.mp4")).toBe(true);
  });

  it("is false for an unsupported one", () => {
    expect(isEmbeddableVideoUrl("https://example.com/watch-my-video")).toBe(false);
  });
});

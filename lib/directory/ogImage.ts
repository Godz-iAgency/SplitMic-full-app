/**
 * Pulls a business's own preview photo off its website — the same image that
 * shows up when the site's link is shared on iMessage, Facebook, etc.
 *
 * Free: no API key, no billing, just reading one meta tag out of a page's own
 * HTML. Server-only; same never-throws/typed-result contract as every other
 * external client here (lib/ai/gemini.ts, lib/directory/screenshots.ts).
 */

const TIMEOUT_MS = 10_000;

/** A page with no og:image this large probably isn't worth waiting on further. */
const MAX_BYTES = 2 * 1024 * 1024;

export type OgImageResult =
  | { ok: true; url: string | null }
  | { ok: false; reason: string };

/**
 * Fetches `websiteUrl` and returns its Open Graph (or Twitter Card) image,
 * resolved to an absolute URL. `{ ok: true, url: null }` means the page loaded
 * fine but simply has no preview image set — a real answer, not a failure.
 */
export async function fetchOgImage(websiteUrl: string): Promise<OgImageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: {
        // Some sites serve a stripped page to unrecognized bots; a normal
        // browser UA gets the same markup a human visitor would see.
        "User-Agent":
          "Mozilla/5.0 (compatible; SplitMicBot/1.0; +https://splitmic.com)",
        Accept: "text/html",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return { ok: false, reason: `Site returned ${response.status}` };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return { ok: false, reason: `Site returned ${contentType || "no content type"}, not HTML` };
    }

    const html = await readCapped(response, MAX_BYTES);
    const rawImage = extractMetaImage(html);
    if (!rawImage) return { ok: true, url: null };

    const resolved = resolveUrl(rawImage, response.url || websiteUrl);
    return { ok: true, url: resolved };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? "Timed out fetching the site"
        : "Could not reach the site";
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

/** Reads a response body up to a byte cap, so one huge page can't hang a batch. */
async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
      if (total >= maxBytes) {
        reader.cancel().catch(() => {});
        break;
      }
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

/**
 * Looks for an og:image (preferred) or twitter:image meta tag. Handles both
 * attribute orders and quote styles real-world pages actually use — this is
 * not a general HTML parser, just enough to find one tag.
 */
function extractMetaImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return match[1];
  }
  return null;
}

/** og:image is often a relative or protocol-relative path — resolve against the page. */
function resolveUrl(raw: string, pageUrl: string): string | null {
  try {
    const url = new URL(raw, pageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

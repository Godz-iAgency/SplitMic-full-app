/**
 * Captures a screenshot of a business's website via Firecrawl.
 *
 * Same contract as lib/events/do512.ts: server-only key, AbortController
 * timeout, discriminated-union result, never throws — one bad website must not
 * take down a whole backfill batch.
 */

const ENDPOINT = "https://api.firecrawl.dev/v1/scrape";

/** Screenshots are slow: a cold page load plus render. */
const TIMEOUT_MS = 45_000;

/** Wide enough to read, short enough to crop to a card band. */
const VIEWPORT = { width: 1280, height: 800 };

export type ScreenshotResult =
  | { ok: true; url: string }
  | { ok: false; reason: string };

export async function captureScreenshot(
  websiteUrl: string,
): Promise<ScreenshotResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return { ok: false, reason: "FIRECRAWL_API_KEY is not set" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        url: websiteUrl,
        formats: [
          {
            type: "screenshot",
            // Above-the-fold only — that's the part that reads as the site's
            // identity, and a full-page capture of a long homepage crops to
            // nothing useful in a 112px card band.
            fullPage: false,
            viewport: VIEWPORT,
          },
        ],
      }),
    });

    if (!response.ok) {
      return { ok: false, reason: `Firecrawl returned ${response.status}` };
    }

    const body = await response.json();
    // Firecrawl has returned this under a couple of shapes across versions;
    // accept either rather than silently failing on the one we didn't expect.
    const url: unknown = body?.data?.screenshot ?? body?.data?.screenshotUrl;
    if (typeof url !== "string" || !url) {
      return { ok: false, reason: "Firecrawl returned no screenshot" };
    }

    return { ok: true, url };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? "Screenshot timed out"
        : "Could not reach Firecrawl";
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

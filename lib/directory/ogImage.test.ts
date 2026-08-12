import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchOgImage } from "./ogImage";

function htmlResponse(html: string, url = "https://example.com/") {
  return {
    ok: true,
    url,
    headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
    body: {
      getReader: () => {
        let sent = false;
        return {
          read: async () => {
            if (sent) return { done: true, value: undefined };
            sent = true;
            return { done: false, value: new TextEncoder().encode(html) };
          },
          cancel: async () => {},
        };
      },
    },
  } as unknown as Response;
}

describe("fetchOgImage", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("extracts a property-then-content og:image tag", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      htmlResponse('<meta property="og:image" content="https://example.com/hero.jpg">'),
    ) as unknown as typeof fetch;

    const result = await fetchOgImage("https://example.com/");
    expect(result).toEqual({ ok: true, url: "https://example.com/hero.jpg" });
  });

  it("extracts a content-then-property og:image tag (attribute order flipped)", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      htmlResponse('<meta content="https://example.com/hero.jpg" property="og:image">'),
    ) as unknown as typeof fetch;

    const result = await fetchOgImage("https://example.com/");
    expect(result).toEqual({ ok: true, url: "https://example.com/hero.jpg" });
  });

  it("falls back to twitter:image when there is no og:image", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      htmlResponse('<meta name="twitter:image" content="https://example.com/tw.jpg">'),
    ) as unknown as typeof fetch;

    const result = await fetchOgImage("https://example.com/");
    expect(result).toEqual({ ok: true, url: "https://example.com/tw.jpg" });
  });

  it("resolves a relative image path against the page URL", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      htmlResponse(
        '<meta property="og:image" content="/img/hero.jpg">',
        "https://example.com/venues/mohawk",
      ),
    ) as unknown as typeof fetch;

    const result = await fetchOgImage("https://example.com/venues/mohawk");
    expect(result).toEqual({ ok: true, url: "https://example.com/img/hero.jpg" });
  });

  it("resolves against the final URL after a redirect, not the requested one", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      htmlResponse(
        '<meta property="og:image" content="/hero.jpg">',
        "https://www.example.com/", // redirected from bare example.com
      ),
    ) as unknown as typeof fetch;

    const result = await fetchOgImage("https://example.com/");
    expect(result).toEqual({ ok: true, url: "https://www.example.com/hero.jpg" });
  });

  it("returns ok with a null url when the page has no preview image", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(htmlResponse("<html><head><title>No image here</title></head></html>")) as unknown as typeof fetch;

    const result = await fetchOgImage("https://example.com/");
    expect(result).toEqual({ ok: true, url: null });
  });

  it("rejects a javascript: URL disguised as an image", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      htmlResponse('<meta property="og:image" content="javascript:alert(1)">'),
    ) as unknown as typeof fetch;

    const result = await fetchOgImage("https://example.com/");
    expect(result).toEqual({ ok: true, url: null });
  });

  it("fails without throwing on a non-200 response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      url: "https://example.com/",
      headers: new Headers(),
    }) as unknown as typeof fetch;

    const result = await fetchOgImage("https://example.com/");
    expect(result).toEqual({ ok: false, reason: "Site returned 404" });
  });

  it("fails without throwing when the response isn't HTML", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: "https://example.com/file.pdf",
      headers: new Headers({ "content-type": "application/pdf" }),
    }) as unknown as typeof fetch;

    const result = await fetchOgImage("https://example.com/file.pdf");
    expect(result.ok).toBe(false);
  });

  it("fails without throwing on a network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;

    const result = await fetchOgImage("https://example.com/");
    expect(result).toEqual({ ok: false, reason: "Could not reach the site" });
  });

  it("fails without throwing on a timeout", async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    }) as unknown as typeof fetch;

    const result = await fetchOgImage("https://example.com/");
    expect(result).toEqual({ ok: false, reason: "Timed out fetching the site" });
  });
});

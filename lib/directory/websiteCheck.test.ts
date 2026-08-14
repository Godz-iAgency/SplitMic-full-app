import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkWebsiteLive } from "./websiteCheck";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function mockFetch(impl: (...args: unknown[]) => unknown) {
  global.fetch = vi.fn(impl) as unknown as typeof fetch;
}

describe("checkWebsiteLive", () => {
  it("classifies a 200 as live", async () => {
    mockFetch(async () => new Response(null, { status: 200 }));
    const result = await checkWebsiteLive("https://mohawk.com");
    expect(result).toEqual({ status: "live", httpStatus: 200, reason: "Site responded 200" });
  });

  it("classifies a redirect-followed 200 as live", async () => {
    mockFetch(async () => new Response(null, { status: 301 }));
    const result = await checkWebsiteLive("https://mohawk.com");
    expect(result.status).toBe("live");
  });

  it("classifies a 404 as dead", async () => {
    mockFetch(async () => new Response(null, { status: 404 }));
    const result = await checkWebsiteLive("https://gone.com");
    expect(result).toMatchObject({ status: "dead", httpStatus: 404 });
  });

  it("classifies a 410 as dead", async () => {
    mockFetch(async () => new Response(null, { status: 410 }));
    const result = await checkWebsiteLive("https://gone.com");
    expect(result.status).toBe("dead");
  });

  it("classifies a 403 as uncertain, not dead (could be bot-blocking)", async () => {
    mockFetch(async () => new Response(null, { status: 403 }));
    const result = await checkWebsiteLive("https://blocked.com");
    expect(result.status).toBe("uncertain");
  });

  it("classifies a 500 as uncertain, not dead (could be transient)", async () => {
    mockFetch(async () => new Response(null, { status: 500 }));
    const result = await checkWebsiteLive("https://flaky.com");
    expect(result.status).toBe("uncertain");
  });

  it("classifies a DNS failure as dead", async () => {
    mockFetch(async () => {
      const err = new TypeError("fetch failed");
      (err as Error & { cause?: unknown }).cause = { code: "ENOTFOUND" };
      throw err;
    });
    const result = await checkWebsiteLive("https://expired-domain.com");
    expect(result).toMatchObject({ status: "dead", reason: "Domain no longer resolves" });
  });

  it("classifies a connection refusal as dead", async () => {
    mockFetch(async () => {
      const err = new TypeError("fetch failed");
      (err as Error & { cause?: unknown }).cause = { code: "ECONNREFUSED" };
      throw err;
    });
    const result = await checkWebsiteLive("https://down.com");
    expect(result.status).toBe("dead");
  });

  it("classifies a timeout as uncertain, not dead", async () => {
    mockFetch(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    const result = await checkWebsiteLive("https://slow.com");
    expect(result).toMatchObject({ status: "uncertain", reason: "Timed out fetching the site" });
  });

  it("classifies an unrecognized network error as uncertain", async () => {
    mockFetch(async () => {
      throw new TypeError("fetch failed");
    });
    const result = await checkWebsiteLive("https://weird.com");
    expect(result.status).toBe("uncertain");
  });
});

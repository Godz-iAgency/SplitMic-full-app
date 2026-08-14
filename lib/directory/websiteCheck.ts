/**
 * Checks whether a directory listing's website is actually still up — a
 * scraped CSV of ~580 businesses inevitably includes some that have since
 * closed, changed domains, or let their site lapse. This is what decides
 * `live` vs `dead` vs `uncertain` so the admin panel can tell a real,
 * confirmable lead from a stale one.
 *
 * Free: no API key, no billing, a plain fetch. Server-only; same
 * never-throws/typed-result contract as lib/directory/ogImage.ts.
 *
 * Deliberately conservative about calling something `dead` — only a domain
 * that no longer resolves, a refused connection, or a hard 404/410 counts.
 * Everything else ambiguous (timeout, TLS error, 5xx, a 403 that might just be
 * bot-blocking) is `uncertain` rather than `dead`, so a flaky moment never
 * gets a real, still-open business removed from the directory.
 */

const TIMEOUT_MS = 10_000;

export type WebsiteCheckStatus = "live" | "dead" | "uncertain";

export type WebsiteCheckResult = {
  status: WebsiteCheckStatus;
  httpStatus: number | null;
  reason: string;
};

export async function checkWebsiteLive(
  websiteUrl: string,
): Promise<WebsiteCheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SplitMicBot/1.0; +https://splitmic.com)",
      },
      redirect: "follow",
    });

    return classifyResponse(response.status);
  } catch (err) {
    return classifyError(err);
  } finally {
    clearTimeout(timer);
  }
}

function classifyResponse(httpStatus: number): WebsiteCheckResult {
  if (httpStatus === 404 || httpStatus === 410) {
    return { status: "dead", httpStatus, reason: `Site returned ${httpStatus}` };
  }
  if (httpStatus >= 200 && httpStatus < 400) {
    return { status: "live", httpStatus, reason: `Site responded ${httpStatus}` };
  }
  if (httpStatus >= 500) {
    return {
      status: "uncertain",
      httpStatus,
      reason: `Site returned ${httpStatus} (server error, may be temporary)`,
    };
  }
  // Other 4xx (401, 403, 429...) — often bot-blocking, not proof the
  // business is gone.
  return {
    status: "uncertain",
    httpStatus,
    reason: `Site returned ${httpStatus}`,
  };
}

function classifyError(err: unknown): WebsiteCheckResult {
  if (err instanceof Error && err.name === "AbortError") {
    return { status: "uncertain", httpStatus: null, reason: "Timed out fetching the site" };
  }

  const code = errorCode(err);
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return { status: "dead", httpStatus: null, reason: "Domain no longer resolves" };
  }
  if (code === "ECONNREFUSED") {
    return { status: "dead", httpStatus: null, reason: "Connection refused" };
  }

  return { status: "uncertain", httpStatus: null, reason: "Could not reach the site" };
}

/** Node's fetch (undici) wraps the network error as `cause` on the TypeError it throws. */
function errorCode(err: unknown): string | undefined {
  if (!(err instanceof Error)) return undefined;
  const cause = (err as Error & { cause?: unknown }).cause;
  if (cause && typeof cause === "object" && "code" in cause) {
    return String((cause as { code: unknown }).code);
  }
  return undefined;
}

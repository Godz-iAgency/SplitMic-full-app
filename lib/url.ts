/**
 * Normalizes a user-entered website into a clean `www.` form.
 *
 * Accepts anything the user types — bare domain, with or without protocol,
 * with or without www, trailing slash — and returns a consistent value:
 *
 *   "rasmonimusic.com"            -> "www.rasmonimusic.com"
 *   "https://rasmonimusic.com/"   -> "www.rasmonimusic.com"
 *   "www.rasmonimusic.com"        -> "www.rasmonimusic.com"
 *   "http://RASMONIMUSIC.com/live"-> "www.rasmonimusic.com/live"
 *
 * Returns null for empty input. The stored value has no protocol on purpose —
 * the profile page prepends https:// when building the clickable link, so users
 * never have to type (or see) "https://".
 */
export function normalizeWebsiteUrl(
  input: string | null | undefined,
): string | null {
  if (!input) return null;

  let s = input.trim();
  if (!s) return null;

  // Strip leading protocol (http:// or https://)
  s = s.replace(/^https?:\/\//i, "");
  // Strip a leading www. (we re-add it consistently below)
  s = s.replace(/^www\./i, "");
  // Strip trailing slashes
  s = s.replace(/\/+$/, "");
  if (!s) return null;

  // Lowercase the host portion only; preserve any path/query casing
  const slash = s.indexOf("/");
  if (slash === -1) {
    s = s.toLowerCase();
  } else {
    s = s.slice(0, slash).toLowerCase() + s.slice(slash);
  }

  return `www.${s}`;
}

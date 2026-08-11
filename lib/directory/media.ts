/**
 * Card imagery and outbound-link helpers for directory listings.
 *
 * All pure string work — no fetch, no database — so the URL-building edge
 * cases (business names with & or ', sites on a subdomain, malformed scraped
 * URLs) are directly testable.
 */

/**
 * A business's logo, derived from its website's favicon at render time.
 *
 * Nothing is stored: Google's endpoint takes a domain and always returns an
 * image (a generic globe when it has nothing better), so there's no 404 branch
 * and no column to keep in sync. Returns null only when we have no usable
 * website to derive from, in which case the card falls back to its initial.
 */
export function faviconUrl(websiteUrl: string | null, size = 128): string | null {
  const host = hostOf(websiteUrl);
  if (!host) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
}

/** Bare host for display, e.g. "https://www.mohawk.com/x" -> "mohawk.com". */
export function displayHost(websiteUrl: string): string {
  return hostOf(websiteUrl)?.replace(/^www\./, "") ?? websiteUrl;
}

/**
 * Google Maps directions to a business.
 *
 * Searched by name + "Austin, TX" rather than by address: the scrape only
 * captured street addresses for a handful of rows, and Maps resolves a named
 * local business reliably. No API key needed for a plain maps URL.
 */
export function directionsUrl(businessName: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    searchTerm(businessName),
  )}`;
}

/** Google Maps listing for a business, where its reviews live. */
export function reviewsUrl(businessName: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    searchTerm(businessName),
  )}`;
}

/** Everything in this directory is Austin, so scope the search to it. */
function searchTerm(businessName: string): string {
  return `${businessName.trim()}, Austin, TX`;
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.host || null;
  } catch {
    return null;
  }
}

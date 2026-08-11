/**
 * Google Places lookups for directory listings.
 *
 * Matches a scraped business name to its Google Maps place and pulls that
 * place's photo — the real venue shot, rather than a screenshot of its
 * website. Server-only; same never-throws/typed-result contract as the other
 * external clients here (lib/ai/gemini.ts, lib/directory/screenshots.ts).
 *
 * Uses the Places API (New). The key is the existing Maps key, which needs
 * "Places API (New)" enabled on it in Google Cloud Console.
 */

const SEARCH_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const PLACES_BASE = "https://places.googleapis.com/v1";

const TIMEOUT_MS = 15_000;

/** Wide enough for a retina card band without pulling a full-resolution photo. */
export const PHOTO_MAX_WIDTH_PX = 800;

/** Austin city center, so a generic business name resolves locally. */
const AUSTIN_BIAS = {
  circle: {
    center: { latitude: 30.2672, longitude: -97.7431 },
    radius: 40_000.0,
  },
};

export type PlaceMatch = {
  placeId: string;
  /** Durable photo resource name, or null when the place has no photo. */
  photoName: string | null;
};

export type PlacesResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

function apiKey(): string | null {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;
}

/**
 * Finds the Google place for a business name, scoped to Austin.
 *
 * Returns `{ ok: true, data: null }` when Google has no match at all — that's
 * a real answer, not a failure, and the caller records it so the business is
 * never looked up again.
 */
export async function findPlace(
  businessName: string,
): Promise<PlacesResult<PlaceMatch | null>> {
  const key = apiKey();
  if (!key) {
    return { ok: false, reason: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(SEARCH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        // The new API bills by the fields requested, so ask for the minimum.
        "X-Goog-FieldMask": "places.id,places.photos",
      },
      signal: controller.signal,
      body: JSON.stringify({
        textQuery: `${businessName.trim()}, Austin, TX`,
        maxResultCount: 1,
        locationBias: AUSTIN_BIAS,
      }),
    });

    if (!response.ok) {
      return { ok: false, reason: `Places returned ${response.status}` };
    }

    const body = await response.json();
    const place = body?.places?.[0];
    if (!place?.id) return { ok: true, data: null };

    const photoName: unknown = place.photos?.[0]?.name;
    return {
      ok: true,
      data: {
        placeId: place.id,
        photoName: typeof photoName === "string" ? photoName : null,
      },
    };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? "Places lookup timed out"
        : "Could not reach Google Places";
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolves a photo resource name to a displayable image URL.
 *
 * `skipHttpRedirect` makes Google return the target URI as JSON instead of
 * 302-ing to it, which keeps the API key out of anything we hand to the
 * browser — the stored URL points at Google's image CDN, not at the keyed
 * endpoint.
 */
export async function resolvePhotoUrl(
  photoName: string,
): Promise<PlacesResult<string>> {
  const key = apiKey();
  if (!key) {
    return { ok: false, reason: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url =
      `${PLACES_BASE}/${photoName}/media` +
      `?maxWidthPx=${PHOTO_MAX_WIDTH_PX}&skipHttpRedirect=true&key=${encodeURIComponent(key)}`;

    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return { ok: false, reason: `Photo returned ${response.status}` };
    }

    const body = await response.json();
    const photoUri: unknown = body?.photoUri;
    if (typeof photoUri !== "string" || !photoUri) {
      return { ok: false, reason: "Places returned no photo URI" };
    }

    return { ok: true, data: photoUri };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? "Photo lookup timed out"
        : "Could not reach Google Places";
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

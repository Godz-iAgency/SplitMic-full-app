import type { LiveEventCard } from "./queries";

/**
 * Shared "how do I get there" URL builders. Used by the always-visible
 * Directions/Uber buttons (GetThereButtons) and by the no-match chooser
 * overlay (VenueLinkOverlay), so there's one definition of "the venue's
 * destination" instead of two copies that could drift.
 */

export function buildDirectionsUrl(event: LiveEventCard): string {
  const destination =
    event.venueLatitude != null && event.venueLongitude != null
      ? `${event.venueLatitude},${event.venueLongitude}`
      : event.venueAddress || `${event.venueName}, Austin, TX`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/**
 * Uber's current documented Universal Deep Link
 * (developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction).
 * `m.uber.com/ul/?action=setPickup&dropoff[...]=...` — what this used to
 * build — isn't a documented endpoint at all; it silently redirected to
 * Uber's plain marketing page with nothing filled in, on both desktop and a
 * real phone. The real format is `m.uber.com/looking`, and drop-off is a
 * single URL-encoded JSON object under `drop[0]`, not bracketed query keys.
 * Pickup is intentionally omitted — the docs' own guidance for "use the
 * rider's current location" is to leave `pickup` out entirely, which is
 * exactly what we want since we only ever know the venue (the drop-off).
 */
export function buildUberUrl(event: LiveEventCard): string {
  const drop: { latitude?: number; longitude?: number; addressLine1: string; addressLine2?: string } = {
    addressLine1: event.venueName,
  };
  if (event.venueLatitude != null && event.venueLongitude != null) {
    drop.latitude = event.venueLatitude;
    drop.longitude = event.venueLongitude;
  }
  if (event.venueAddress) {
    drop.addressLine2 = event.venueAddress;
  }

  const params = new URLSearchParams({ "drop[0]": JSON.stringify(drop) });

  // The Client ID is public by design — it identifies the requesting app and
  // travels in the URL's query string regardless, not a secret.
  const clientId = process.env.NEXT_PUBLIC_UBER_CLIENT_ID;
  if (clientId) {
    params.set("client_id", clientId);
  }

  return `https://m.uber.com/looking?${params.toString()}`;
}

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

export function buildUberUrl(event: LiveEventCard): string {
  const params = new URLSearchParams({
    action: "setPickup",
    "dropoff[formatted_address]": event.venueAddress || `${event.venueName}, Austin, TX`,
  });
  if (event.venueLatitude != null && event.venueLongitude != null) {
    params.set("dropoff[latitude]", String(event.venueLatitude));
    params.set("dropoff[longitude]", String(event.venueLongitude));
  }
  // Uber's web fallback stopped honoring guest prefill without a registered
  // app identifying the request (see PROGRESS.md §4 #1). Omitted entirely
  // when unset rather than sent empty, so a missing env var degrades to the
  // prior (broken-prefill) behavior instead of a malformed request.
  const clientId = process.env.NEXT_PUBLIC_UBER_CLIENT_ID;
  if (clientId) {
    params.set("client_id", clientId);
  }
  return `https://m.uber.com/ul/?${params.toString()}`;
}

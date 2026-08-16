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
  return `https://m.uber.com/ul/?${params.toString()}`;
}

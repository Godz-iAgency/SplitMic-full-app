import type { LiveEventCard } from "./queries";

/**
 * Shared "how do I get there" URL builders. Used by the always-visible
 * Directions/Uber buttons (GetThereButtons) and by the no-match chooser
 * overlay (VenueLinkOverlay), so there's one definition of "the venue's
 * destination" instead of two copies that could drift.
 */

/**
 * The "Buy Tickets" destination — currently a passthrough to the stored
 * `ticket_url`, but centralized here (rather than components reading
 * `event.ticketUrl` directly) so that affiliate tracking, once the
 * Ticketmaster affiliate program application is approved, is a one-line
 * change in this one function instead of a change everywhere a ticket link
 * is rendered. Returns null when there's nothing to link to — the caller
 * decides whether that means hiding the button.
 */
export function buildTicketUrl(event: LiveEventCard): string | null {
  return event.ticketUrl;
}

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

/** The Play Store package for Uber's *rider* app (not the driver app). */
const UBER_ANDROID_PACKAGE = "com.ubercab";

/**
 * Android-only escape hatch, for when the https link above opens Chrome
 * instead of the Uber app.
 *
 * The https link is an Android App Link, which only hands off to the app if
 * Android has *verified* the m.uber.com ↔ app association on that specific
 * device and the user hasn't turned "Open supported links" off for Uber.
 * Both were confirmed correct at the domain level (m.uber.com serves a valid
 * assetlinks.json granting com.ubercab handle_all_urls), so a device that
 * still opens Chrome is failing that per-device verification — which no
 * amount of URL tweaking can force.
 *
 * An `intent://` URL sidesteps the whole mechanism: naming `package=` makes
 * it an explicit intent, so Chrome hands off regardless of App Links state,
 * and `S.browser_fallback_url` degrades to the normal web link when the app
 * isn't installed at all.
 *
 * Note this uses Uber's *native* scheme, which takes bracketed params
 * (`dropoff[formatted_address]`) rather than the `drop[0]` JSON object the
 * m.uber.com web link wants — they are two different documented formats and
 * are not interchangeable. Per Uber's deep-link FAQ, a dropoff will not
 * appear in the native app at all unless `dropoff[nickname]` or
 * `dropoff[formatted_address]` is set, so both are always sent.
 */
export function buildUberAppIntentUrl(event: LiveEventCard): string {
  const params = new URLSearchParams({
    action: "setPickup",
    // Documented sentinel for "start from wherever the rider is."
    pickup: "my_location",
    "dropoff[nickname]": event.venueName,
    "dropoff[formatted_address]":
      event.venueAddress || `${event.venueName}, Austin, TX`,
  });
  if (event.venueLatitude != null && event.venueLongitude != null) {
    params.set("dropoff[latitude]", String(event.venueLatitude));
    params.set("dropoff[longitude]", String(event.venueLongitude));
  }

  const fallback = encodeURIComponent(buildUberUrl(event));
  return (
    `intent://riderequest?${params.toString()}` +
    `#Intent;scheme=uber;package=${UBER_ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${fallback};end`
  );
}

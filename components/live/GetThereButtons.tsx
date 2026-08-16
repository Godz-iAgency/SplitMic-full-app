import { Navigation, Car } from "lucide-react";
import type { LiveEventCard } from "@/lib/events/queries";

type Props = {
  event: LiveEventCard;
};

/**
 * Plain <a> links, not buttons with onClick — no JS needed, works for
 * crawlers and before hydration. Both are universal links: they open the
 * installed app on mobile automatically and fall back to the web version
 * otherwise, no API key required for either.
 */
export function GetThereButtons({ event }: Props) {
  const destination =
    event.venueLatitude != null && event.venueLongitude != null
      ? `${event.venueLatitude},${event.venueLongitude}`
      : event.venueAddress || `${event.venueName}, Austin, TX`;

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;

  const uberParams = new URLSearchParams({
    action: "setPickup",
    "dropoff[formatted_address]": event.venueAddress || `${event.venueName}, Austin, TX`,
  });
  if (event.venueLatitude != null && event.venueLongitude != null) {
    uberParams.set("dropoff[latitude]", String(event.venueLatitude));
    uberParams.set("dropoff[longitude]", String(event.venueLongitude));
  }
  const uberUrl = `https://m.uber.com/ul/?${uberParams.toString()}`;

  return (
    // relative + z-10: sits above EventCard's stretched venue-link overlay
    // (z-[1]) so these stay independently clickable when the card itself is
    // wrapped in a link.
    <div className="relative z-10 mt-3 flex gap-2">
      {/* Color language, not logo assets — reads as "Google Maps" / "Uber"
          without redistributing either company's trademarked mark. */}
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 transition hover:border-blue-400/60 hover:bg-blue-500/20"
      >
        <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
        Directions
      </a>
      <a
        href={uberUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
      >
        <Car className="h-3.5 w-3.5" aria-hidden="true" />
        Get an Uber
      </a>
    </div>
  );
}

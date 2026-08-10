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
    <div className="mt-3 flex gap-2">
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-brand-gray-300 transition hover:border-brand-orange/40 hover:text-brand-orange"
      >
        <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
        Directions
      </a>
      <a
        href={uberUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-brand-gray-300 transition hover:border-brand-orange/40 hover:text-brand-orange"
      >
        <Car className="h-3.5 w-3.5" aria-hidden="true" />
        Get an Uber
      </a>
    </div>
  );
}

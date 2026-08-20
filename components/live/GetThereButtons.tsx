import { Navigation, Car, Ticket, ExternalLink } from "lucide-react";
import type { LiveEventCard } from "@/lib/events/queries";
import { buildDirectionsUrl, buildTicketLink } from "@/lib/events/getThereLinks";
import { UberLink } from "./UberLink";

type Props = {
  event: LiveEventCard;
};

/**
 * Plain <a> links, not buttons with onClick — no JS needed, works for
 * crawlers and before hydration. Directions/Uber are universal links: they
 * open the installed app on mobile automatically and fall back to the web
 * version otherwise, no API key required for either.
 */
export function GetThereButtons({ event }: Props) {
  const directionsUrl = buildDirectionsUrl(event);
  const ticketLink = buildTicketLink(event);

  return (
    // relative + z-10: sits above EventCard's stretched venue-link overlay
    // (z-[1]) so these stay independently clickable when the card itself is
    // wrapped in a link.
    <div className="relative z-10 mt-3 flex flex-col gap-2">
      {/* Full-width on its own row when present, since it's the primary action
          for a ticketed show. The label and emphasis come from
          buildTicketLink, not from this component: only a real point of sale
          says "Buy Tickets" and gets the brand fill. A Do512 URL is that
          show's page on a local events calendar, so promising a purchase there
          would be a lie the user only discovers after tapping. */}
      {ticketLink ? (
        <a
          href={ticketLink.href}
          target="_blank"
          rel="noopener noreferrer"
          className={
            ticketLink.isCheckout
              ? "tappable inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-orange px-3 py-1.5 text-xs font-bold text-black hover:bg-brand-orange/90"
              : "tappable inline-flex items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
          }
        >
          {ticketLink.isCheckout ? (
            <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {ticketLink.label}
        </a>
      ) : null}
      <div className="flex gap-2">
        {/* Color language, not logo assets — reads as "Google Maps" / "Uber"
            without redistributing either company's trademarked mark. */}
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tappable inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:border-blue-400/60 hover:bg-blue-500/20"
        >
          <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
          Directions
        </a>
        <UberLink
          event={event}
          className="tappable inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
        >
          <Car className="h-3.5 w-3.5" aria-hidden="true" />
          Get an Uber
        </UberLink>
      </div>
    </div>
  );
}

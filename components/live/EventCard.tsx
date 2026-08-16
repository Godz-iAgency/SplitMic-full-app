import Link from "next/link";
import { MapPin, ChevronRight } from "lucide-react";
import type { LiveEventCard as EventCardData } from "@/lib/events/queries";
import { formatEventDayLabel, formatEventTime } from "@/lib/events/time";
import { CATEGORY_META } from "@/lib/directory/categories";
import { reviewsUrl } from "@/lib/directory/media";
import { GetThereButtons } from "./GetThereButtons";
import { EventImageBand } from "./EventImageBand";

type Props = {
  event: EventCardData;
};

export function EventCard({ event }: Props) {
  // Every card is clickable through to "more about this venue" — a real
  // SplitMic venue profile if one exists, else the matched directory
  // listing, else a Google Maps search for the venue by name (the same
  // technique the directory's own Reviews button already uses: reliable for
  // a named local business, no stored address needed). An unclickable card
  // was tried first and rejected after seeing it live — it reads as broken
  // more than it reads as "no data available."
  const venueHref =
    event.matchedProfileType === "venue" && event.matchedProfileId
      ? `/profile/${event.matchedProfileId}`
      : event.directoryBusinessId
        ? `/directory/${CATEGORY_META.venue.slug}#b-${event.directoryBusinessId}`
        : reviewsUrl(event.venueName);
  const venueHrefIsExternal = venueHref.startsWith("http");

  // Do512's own event poster is more specific than the venue's general
  // photo, so it wins when present.
  const cardImageUrl = event.imageUrl || event.directoryPhotoUrl;

  return (
    <article
      id={`event-${event.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-gray-900 to-black transition-colors duration-200 hover:border-brand-orange/40"
    >
      <EventImageBand imageUrl={cardImageUrl} alt={event.venueName} />

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-base font-bold leading-snug text-white">
          {event.artistName}
        </h3>
        <div className="mt-1 flex items-center gap-1.5 text-sm text-brand-gray-300">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-gray-400" aria-hidden="true" />
          <span className="truncate">{event.venueName}</span>
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 text-brand-gray-500 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>

        <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
          <span className="text-brand-orange">
            {formatEventDayLabel(event.eventDatetime)} · {formatEventTime(event.eventDatetime)}
          </span>
          {event.isFree ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-brand-gray-300">
              Free
            </span>
          ) : null}
        </div>

        <GetThereButtons event={event} />
      </div>

      {/* Stretched link: makes the whole card clickable through to "more
          about this venue" without wrapping the Directions/Uber links in a
          nested <a> (invalid HTML, and unpredictable click targeting). It's
          a sibling overlay instead, sitting at a low z-index so the two
          buttons above (z-10) stay independently clickable; everything else
          in the card is plain static content, which a positioned sibling
          paints over regardless of DOM order. */}
      <Link
        href={venueHref}
        className="absolute inset-0 z-[1]"
        aria-label={`More about ${event.venueName}`}
        {...(venueHrefIsExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        <span className="sr-only">More about {event.venueName}</span>
      </Link>
    </article>
  );
}

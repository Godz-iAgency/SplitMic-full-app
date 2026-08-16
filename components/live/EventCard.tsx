import { MapPin, ChevronRight } from "lucide-react";
import type { LiveEventCard as EventCardData } from "@/lib/events/queries";
import { formatEventDayLabel, formatEventTime } from "@/lib/events/time";
import { CATEGORY_META } from "@/lib/directory/categories";
import { GetThereButtons } from "./GetThereButtons";
import { EventImageBand } from "./EventImageBand";
import { VenueLinkOverlay } from "./VenueLinkOverlay";

type Props = {
  event: EventCardData;
};

export function EventCard({ event }: Props) {
  // A real venue page to send someone to: a SplitMic profile if one exists,
  // else the matched directory listing. Null when neither matched — in that
  // case VenueLinkOverlay offers wayfinding instead of pretending a page
  // exists (see that file). Every card is still clickable either way; an
  // unclickable card was tried first and rejected after seeing it live.
  const venueHref =
    event.matchedProfileType === "venue" && event.matchedProfileId
      ? `/profile/${event.matchedProfileId}`
      : event.directoryBusinessId
        ? `/directory/${CATEGORY_META.venue.slug}#b-${event.directoryBusinessId}`
        : null;

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

      {/* Stretched overlay: makes the whole card clickable without wrapping
          the Directions/Uber links in a nested <a> (invalid HTML,
          unpredictable click targeting). It's a sibling overlay instead,
          sitting at a low z-index so the two buttons above (z-10) stay
          independently clickable; everything else in the card is plain
          static content, which a positioned sibling paints over regardless
          of DOM order. */}
      <VenueLinkOverlay event={event} venueHref={venueHref} />
    </article>
  );
}

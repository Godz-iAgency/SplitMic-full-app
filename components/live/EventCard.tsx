import Link from "next/link";
import { MapPin } from "lucide-react";
import type { LiveEventCard as EventCardData } from "@/lib/events/queries";
import { formatEventDayLabel, formatEventTime } from "@/lib/events/time";
import { GetThereButtons } from "./GetThereButtons";

type Props = {
  event: EventCardData;
};

export function EventCard({ event }: Props) {
  const initial = event.artistName.charAt(0).toUpperCase();
  const profileHref = event.matchedProfileId
    ? `/profile/${event.matchedProfileId}`
    : null;

  return (
    <article
      id={`event-${event.id}`}
      className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-gray-900 to-black"
    >
      <div className="h-1 w-full bg-gradient-to-r from-brand-orange via-brand-orange/60 to-transparent" />

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-gray-800 to-brand-gray-900 ring-1 ring-white/10">
            {event.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.imageUrl}
                alt={event.artistName}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-orange/20 to-brand-orange/5 text-lg font-bold text-brand-orange">
                {initial}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-base font-bold leading-snug text-white">
              {profileHref ? (
                <Link href={profileHref} className="hover:text-brand-orange">
                  {event.artistName}
                </Link>
              ) : (
                event.artistName
              )}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-brand-gray-300">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-gray-400" aria-hidden="true" />
              <span className="truncate">{event.venueName}</span>
            </div>
          </div>
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
    </article>
  );
}

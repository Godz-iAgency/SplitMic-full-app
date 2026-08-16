"use client";

import { useState } from "react";
import Link from "next/link";
import { Navigation, Car, X } from "lucide-react";
import type { LiveEventCard } from "@/lib/events/queries";
import { buildDirectionsUrl, buildUberUrl } from "@/lib/events/getThereLinks";

type Props = {
  event: LiveEventCard;
  /** Internal link to a real venue page (profile or directory listing).
   *  Null when there's no such page to send someone to. */
  venueHref: string | null;
};

/**
 * The whole-card click target (a stretched overlay sibling — see EventCard
 * for why it's a sibling, not a wrapper).
 *
 * When there's a real venue page, this is a plain link to it. When there
 * isn't, pretending a name-only Google search *is* "the venue" was worse
 * than admitting we don't have one: instead this opens the same
 * Directions/Uber choice the visible buttons already offer, framed honestly
 * as wayfinding rather than a fake venue page.
 */
export function VenueLinkOverlay({ event, venueHref }: Props) {
  const [open, setOpen] = useState(false);

  if (venueHref) {
    return (
      <Link
        href={venueHref}
        className="absolute inset-0 z-[1]"
        aria-label={`More about ${event.venueName}`}
      >
        <span className="sr-only">More about {event.venueName}</span>
      </Link>
    );
  }

  const directionsUrl = buildDirectionsUrl(event);
  const uberUrl = buildUberUrl(event);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute inset-0 z-[1]"
        aria-label={`Get directions to ${event.venueName}`}
      />
      {open ? (
        <div
          role="dialog"
          aria-label={`Get to ${event.venueName}`}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/90 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full p-1.5 text-brand-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <p className="mb-1 px-6 text-center text-sm font-semibold text-white">
            Get to {event.venueName}
          </p>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full max-w-[190px] items-center justify-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 transition hover:border-blue-400/60 hover:bg-blue-500/20"
          >
            <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
            Google Maps
          </a>
          <a
            href={uberUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full max-w-[190px] items-center justify-center gap-1.5 rounded-full border border-white/15 bg-black px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            <Car className="h-3.5 w-3.5" aria-hidden="true" />
            Get an Uber
          </a>
        </div>
      ) : null}
    </>
  );
}

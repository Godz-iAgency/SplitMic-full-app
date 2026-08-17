"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Navigation, Car, X } from "lucide-react";
import type { LiveEventCard } from "@/lib/events/queries";
import { buildDirectionsUrl } from "@/lib/events/getThereLinks";
import { UberLink } from "./UberLink";

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
 *
 * Motion is CSS keyframes rather than framer-motion, even though that library
 * is already a dependency: it's currently only pulled in on the landing page,
 * and /live is a public SEO page where adding ~30KB for one small popover
 * isn't a fair trade. This also matches how every other overlay in the app
 * animates (FeatureModal, PlayerTypeModal).
 */
export function VenueLinkOverlay({ event, venueHref }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape to dismiss, and outside-click to dismiss. Without these the only
  // way out was the small X — on a card-local popover that reads as a trap,
  // and it left keyboard users with no exit at all.
  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }
    function handlePointerDown(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  // Move focus into the panel on open so a keyboard or screen-reader user
  // lands on the choice they just asked for, and hand it back to the trigger
  // on close so their place in the card grid isn't lost.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

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

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="absolute inset-0 z-[1]"
        aria-label={`Get directions to ${event.venueName}`}
      />
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          tabIndex={-1}
          aria-label={`Get to ${event.venueName}`}
          className="animate-materialize-in absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/80 p-4 backdrop-blur-md focus:outline-none"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="tappable absolute right-3 top-3 rounded-full p-1.5 text-brand-gray-300 hover:bg-white/10 hover:text-white"
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
            className="tappable inline-flex w-full max-w-[190px] items-center justify-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 hover:border-blue-400/60 hover:bg-blue-500/20"
          >
            <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
            Google Maps
          </a>
          <UberLink
            event={event}
            className="tappable inline-flex w-full max-w-[190px] items-center justify-center gap-1.5 rounded-full border border-white/15 bg-black px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
          >
            <Car className="h-3.5 w-3.5" aria-hidden="true" />
            Get an Uber
          </UberLink>
        </div>
      ) : null}
    </>
  );
}

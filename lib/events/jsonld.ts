import { FAQ_ITEMS } from "./faqContent";
import { CATEGORY_META } from "@/lib/directory/categories";
import type { LiveEventCard } from "./queries";

/**
 * Pure JSON-LD builders for the /live page — no React, no fetch, so they're
 * directly unit-testable. `baseUrl` is passed in rather than read from
 * `process.env` here, so a test doesn't need to fake the environment.
 */

export function buildEventsJsonLd(events: LiveEventCard[], baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@graph": events.map((event) => ({
      "@type": "MusicEvent",
      name: `${event.artistName} at ${event.venueName}`,
      startDate: event.eventDatetime,
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: {
        "@type": "MusicVenue",
        name: event.venueName,
        address: event.venueAddress || `${event.venueName}, Austin, TX`,
      },
      performer: {
        "@type": "MusicGroup",
        name: event.artistName,
        ...(event.matchedProfileId && event.matchedProfileType === "band"
          ? { sameAs: `${baseUrl}/profile/${event.matchedProfileId}` }
          : {}),
      },
      image: event.imageUrl || event.directoryPhotoUrl || undefined,
      url:
        event.ticketUrl ||
        (event.matchedProfileId
          ? `${baseUrl}/profile/${event.matchedProfileId}`
          : event.directoryBusinessId
            ? `${baseUrl}/directory/${CATEGORY_META.venue.slug}#b-${event.directoryBusinessId}`
            : `${baseUrl}/live#event-${event.id}`),
      isAccessibleForFree: event.isFree ?? undefined,
    })),
  };
}

/**
 * Built from the exact same FAQ_ITEMS array the visible <details> elements
 * render from — Google's structured-data policy requires the two to match
 * verbatim, so there is deliberately only one source of truth.
 */
export function buildFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

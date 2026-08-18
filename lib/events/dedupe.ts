import { namesLikelyMatch } from "./matching";
import type { LiveEventCard } from "./queries";

/**
 * Collapses the same real-world show reported by two different providers
 * (same venue, same artist, close enough in time) down to one card —
 * without ever deleting anything from the database.
 *
 * Deliberately a read-time pass, not a sync-time one. The two providers run
 * on independent schedules (Do512 daily, Ticketmaster every ~4h — see
 * sync.ts), so a Do512 row synced at 9am and a Ticketmaster row synced at
 * 1pm are never in memory together during either sync; the only place both
 * are ever visible at once is a read of the already-stored table. Read-time
 * also makes this non-destructive by construction — there is no delete or
 * deactivate here, so a wrong duplicate guess only ever hides a card for one
 * request, never loses data. That directly satisfies "prevent duplicate
 * listings without accidentally deleting legitimate events."
 */

/** How close two events' start times have to be to count as the same show.
 *  Generous enough to cover "doors" vs "show time" reported differently by
 *  the two sources, narrow enough that two different acts at the same venue
 *  on the same night don't collapse into one. */
const DUPLICATE_WINDOW_MS = 3 * 60 * 60 * 1000;

export function dedupeAcrossProviders(cards: LiveEventCard[]): LiveEventCard[] {
  const kept: LiveEventCard[] = [];

  for (const card of cards) {
    const dupIndex = kept.findIndex((existing) => isSameShow(existing, card));
    if (dupIndex === -1) {
      kept.push(card);
      continue;
    }
    // Prefer the richer source when the same show is reported by both:
    // Ticketmaster gives a real per-event id, a real ticket URL, and a
    // genre; Do512 is the fallback for shows Ticketmaster doesn't sell.
    if (sourcePriority(card.source) > sourcePriority(kept[dupIndex].source)) {
      kept[dupIndex] = card;
    }
  }

  return kept;
}

function isSameShow(a: LiveEventCard, b: LiveEventCard): boolean {
  // Two rows from the same provider are never "duplicates of each other" by
  // this function's definition — same-source uniqueness is already
  // guaranteed by source_event_id at the database level.
  if (a.source === b.source) return false;
  if (!namesLikelyMatch(a.venueName, b.venueName)) return false;
  if (!namesLikelyMatch(a.artistName, b.artistName)) return false;
  const gapMs = Math.abs(
    new Date(a.eventDatetime).getTime() - new Date(b.eventDatetime).getTime(),
  );
  return gapMs <= DUPLICATE_WINDOW_MS;
}

function sourcePriority(source: string): number {
  return source === "ticketmaster" ? 1 : 0;
}

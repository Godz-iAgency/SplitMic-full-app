import { CATEGORY_META } from "@/lib/directory/categories";

/**
 * SplitMic's own generic venue photo — the same asset used for the Venues
 * player-type tile and the directory's Venues category page
 * (lib/directory/categories.ts), so a card with no real photo still reads as
 * "us," not a placeholder. Falls back to the literal path only in the
 * unreachable case that entry loses its image.
 */
const GENERIC_VENUE_PHOTO = CATEGORY_META.venue.image ?? "/players/venue.jpg";

/**
 * Top-of-card photo band for an event: Do512's event poster when it has one,
 * else the matched venue's own directory photo, else SplitMic's generic venue
 * photo.
 *
 * Height uses the same md/lg pattern as the directory's BusinessCard image
 * band, for the same reason: this grid is also `grid-cols-1 sm:grid-cols-2
 * lg:grid-cols-3`, so a card is widest just below `lg` (two columns sharing
 * the row) and narrower again once a third column appears at `lg`. A single
 * fixed height would letterbox worst in the middle of the tablet range —
 * see CLAUDE.md's Responsive and PWA Behavior section.
 */
export function EventImageBand({
  imageUrl,
  alt,
}: {
  imageUrl: string | null;
  alt: string;
}) {
  return (
    <div className="relative h-28 w-full shrink-0 overflow-hidden md:h-36 lg:h-28">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl ?? GENERIC_VENUE_PHOTO}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/5" />
    </div>
  );
}

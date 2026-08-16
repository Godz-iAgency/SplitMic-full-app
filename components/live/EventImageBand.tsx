import { Music } from "lucide-react";

/**
 * Top-of-card photo band for an event: Do512's event poster when it has one,
 * else the matched venue's own directory photo, else a plain gradient.
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
      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={alt}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/5" />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-gray-800 to-black">
          <Music
            className="h-8 w-8 text-brand-orange/30"
            aria-hidden="true"
            strokeWidth={1.5}
          />
        </div>
      )}
    </div>
  );
}

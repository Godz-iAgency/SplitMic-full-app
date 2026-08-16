import { Music } from "lucide-react";

/**
 * Top-of-card photo band for an event: Do512's event poster when it has one,
 * else the matched venue's own directory photo, else fallback art.
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
        <FallbackArt />
      )}
    </div>
  );
}

/**
 * The pre-photo look, ported from the directory's BusinessCard FallbackArt —
 * same glow + dot-grid + oversized watermark treatment, proven there to read
 * as "designed" rather than "empty" (PROGRESS.md §2 #25). A flat gradient
 * with one small centered icon was tried first and looked dead; a card grid
 * with several of these sitting side by side needs it to hold up as a
 * pattern, not just avoid being literally blank.
 */
function FallbackArt() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-brand-gray-900 via-brand-gray-900 to-black">
      {/* Two off-center glows instead of one centered wash — reads as stage
          lighting instead of a flat tint. */}
      <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-brand-orange/25 blur-3xl" />
      <div className="absolute -bottom-12 -right-8 h-36 w-36 rounded-full bg-brand-orange/10 blur-3xl" />

      <div className="absolute inset-0 opacity-[0.15] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.5)_1px,transparent_0)] [background-size:18px_18px]" />

      {/* Oversized, tilted watermark — brightens slightly on hover (the
          parent <article> carries `group`). */}
      <Music
        strokeWidth={1}
        className="absolute -bottom-5 -right-5 h-28 w-28 rotate-[-10deg] text-brand-orange/[0.12] transition-colors duration-300 group-hover:text-brand-orange/25"
      />
    </div>
  );
}

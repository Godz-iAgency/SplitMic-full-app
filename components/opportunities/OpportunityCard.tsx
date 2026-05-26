import Link from "next/link";
import { Calendar, Clock, MapPin, DollarSign, Repeat2 } from "lucide-react";
import { PLAYER_TYPE_OPTIONS, type PlayerType } from "@/lib/types";
import {
  formatPostDate,
  formatEventDateRange,
  formatRelativeTime,
  type MarketplaceCard,
} from "@/lib/supabase/marketplace";

// Post-type label
const TYPE_LABEL: Record<string, string> = {
  event: "Event",
  opportunity: "Opportunity",
};

// Post-type color (subtle accent)
const TYPE_ACCENT: Record<string, string> = {
  event: "text-brand-orange",
  opportunity: "text-blue-300",
};

export function OpportunityCard({ card }: { card: MarketplaceCard }) {
  const typeLabel = TYPE_LABEL[card.post_type] ?? card.post_type;
  const typeAccent = TYPE_ACCENT[card.post_type] ?? "text-brand-orange";
  const playerOption = PLAYER_TYPE_OPTIONS.find(
    (o) => o.value === card.poster_player_type,
  );
  const playerLabel = playerOption?.label ?? card.poster_player_type;

  const isShared = Boolean(card.shared_by_name);

  return (
    <Link
      href={`/opportunities/${card.id}`}
      className="group relative block overflow-hidden rounded-lg border border-white/15 bg-gradient-to-br from-white/[.05] via-white/[.03] to-transparent p-6 shadow-md shadow-black/30 transition-all duration-300 hover:-translate-y-1 hover:border-brand-orange/50 hover:shadow-xl hover:shadow-brand-orange/20 sm:p-7"
    >
      {/* ── Subtle orange glow accent in corner ─────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-orange/10 blur-3xl transition-opacity duration-300 group-hover:bg-brand-orange/20"
      />

      {/* ── Shared-by banner (band re-share attribution) ───────────── */}
      {isShared ? (
        <div className="relative mb-4 flex items-center gap-2.5 rounded-md border border-brand-orange/25 bg-brand-orange/10 px-3 py-2">
          <Repeat2
            className="h-4 w-4 flex-shrink-0 text-brand-orange"
            strokeWidth={2.25}
            aria-hidden="true"
          />
          <div className="flex min-w-0 items-center gap-2">
            {card.shared_by_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.shared_by_avatar_url}
                alt={card.shared_by_name}
                className="h-5 w-5 flex-shrink-0 rounded-full object-cover ring-1 ring-brand-orange/40"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-orange/30 text-[10px] font-bold text-brand-orange"
              >
                {card.shared_by_name?.charAt(0)}
              </span>
            )}
            <p className="truncate text-xs font-semibold text-white">
              <span className="text-brand-orange">Shared by</span>{" "}
              {card.shared_by_name}
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Header row: poster name (left) + post type (right) ──────── */}
      <div className="relative mb-6 flex items-center justify-between gap-3">
        <p className="truncate text-base font-bold tracking-tight text-white">
          {card.poster_name}
        </p>
        <span
          className={`flex-shrink-0 text-[11px] font-bold uppercase tracking-[0.15em] ${typeAccent}`}
        >
          {typeLabel}
        </span>
      </div>

      {/* ── Two-column grid: 1/3 image panel + 2/3 content panel ────── */}
      <div className="relative grid grid-cols-3 gap-6">
        {/* ── LEFT (col-span-1): Inset image + player-type label ───── */}
        <div className="col-span-1 flex flex-col items-center justify-center gap-3">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-brand-gray-800 ring-1 ring-white/15 shadow-lg shadow-black/40">
            {card.poster_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.poster_avatar_url}
                alt={card.poster_name}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-orange/30 via-brand-gray-800 to-black text-5xl font-black text-brand-orange">
                {card.poster_name.charAt(0)}
              </div>
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-white">
              {playerLabel}
            </p>
            <p className="mt-1 text-[10px] font-medium text-brand-gray-400">
              posted {formatRelativeTime(card.created_at)}
            </p>
          </div>
        </div>

        {/* ── RIGHT (col-span-2): Centered content panel ───────────── */}
        <div className="col-span-2 flex flex-col items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-black/60 via-black/40 to-black/60 p-6 text-center shadow-inner shadow-black/40">
          {/* Title */}
          <h3 className="text-xl font-bold leading-tight tracking-tight text-white transition group-hover:text-brand-orange sm:text-2xl">
            {card.title}
          </h3>

          {/* Description */}
          {card.description ? (
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-brand-gray-300">
              {card.description}
            </p>
          ) : null}

          {/* Divider */}
          <div className="my-4 h-px w-12 bg-gradient-to-r from-transparent via-brand-orange/60 to-transparent" />

          {/* Meta row: date + location + pay */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
            {card.post_type === "event" && card.event_date ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                <Calendar
                  className="h-3.5 w-3.5 text-brand-orange"
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
                {formatEventDateRange(card.event_date, card.event_end_date)}
              </span>
            ) : null}
            {card.post_type === "opportunity" && card.open_until ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                <Clock
                  className="h-3.5 w-3.5 text-brand-orange"
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
                Open until {formatPostDate(card.open_until)}
              </span>
            ) : null}
            {card.event_location ? (
              <span className="inline-flex items-center gap-1.5 text-brand-gray-300">
                <MapPin
                  className="h-3.5 w-3.5"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                {card.event_location}
              </span>
            ) : null}
            {card.pay_info ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300">
                <DollarSign
                  className="h-3.5 w-3.5"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                {card.pay_info}
              </span>
            ) : null}
          </div>

          {/* Genre chips */}
          {card.genres.length > 0 ? (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {card.genres.slice(0, 5).map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-white/15 bg-white/[.07] px-3 py-1 text-[11px] font-semibold text-brand-gray-100"
                >
                  {g}
                </span>
              ))}
              {card.genres.length > 5 ? (
                <span className="rounded-full px-3 py-1 text-[11px] font-medium text-brand-gray-400">
                  +{card.genres.length - 5}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Footer: centered CTA with arrow animation ──────────────── */}
      <div className="relative mt-6 flex items-center justify-center">
        <span className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-gray-300 transition group-hover:text-brand-orange">
          View and Respond
          <span className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

import Link from "next/link";
import { PLAYER_TYPE_OPTIONS, type PlayerType } from "@/lib/types";
import {
  formatPostDate,
  formatEventDateRange,
  formatRelativeTime,
  type MarketplaceCard,
} from "@/lib/supabase/marketplace";

// Post-type badge (Event / Opportunity)
const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  event: {
    label: "Event",
    className: "bg-brand-orange/20 text-brand-orange",
  },
  opportunity: {
    label: "Opportunity",
    className: "bg-blue-500/20 text-blue-300",
  },
};

// Player-type chip color per player kind — makes the feed scannable.
const PLAYER_TYPE_CHIP: Record<PlayerType, string> = {
  band: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  venue: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  talent_buyer: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  festival: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  record_label: "bg-pink-500/15 text-pink-300 border-pink-500/30",
};

export function OpportunityCard({ card }: { card: MarketplaceCard }) {
  const badge = TYPE_BADGE[card.post_type];
  const playerOption = PLAYER_TYPE_OPTIONS.find(
    (o) => o.value === card.poster_player_type,
  );
  const playerChip = PLAYER_TYPE_CHIP[card.poster_player_type];

  return (
    <Link
      href={`/opportunities/${card.id}`}
      className="group block rounded-2xl border border-white/5 bg-white/5 p-5 transition hover:border-brand-orange/30 hover:bg-white/[.07] sm:p-6"
    >
      {/* ── Header: poster identity + relative time ─────────────────── */}
      <div className="mb-4 flex items-start gap-3">
        {/* Avatar */}
        {card.poster_avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.poster_avatar_url}
            alt={card.poster_name}
            className="h-12 w-12 flex-shrink-0 rounded-full object-cover ring-2 ring-white/5"
          />
        ) : (
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-gray-800 text-lg font-bold text-brand-orange ring-2 ring-white/5">
            {card.poster_name.charAt(0)}
          </div>
        )}

        {/* Name + player type + time */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-bold text-white">
              {card.poster_name}
            </p>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${playerChip}`}
            >
              {playerOption?.label ?? card.poster_player_type}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-brand-gray-400">
            posted {formatRelativeTime(card.created_at)}
          </p>
        </div>

        {/* Post-type badge — right side */}
        <span
          className={`flex-shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      {/* ── Body: title + description ───────────────────────────────── */}
      <h3 className="text-lg font-bold text-white transition group-hover:text-brand-orange sm:text-xl">
        {card.title}
      </h3>

      {card.description ? (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-brand-gray-300">
          {card.description}
        </p>
      ) : null}

      {/* ── Meta row: date + location + pay ─────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {card.post_type === "event" && card.event_date ? (
          <span className="font-medium text-brand-gray-200">
            📅 {formatEventDateRange(card.event_date, card.event_end_date)}
          </span>
        ) : null}
        {card.post_type === "opportunity" && card.open_until ? (
          <span className="font-medium text-brand-gray-200">
            ⏳ Open until {formatPostDate(card.open_until)}
          </span>
        ) : null}
        {card.event_location ? (
          <span className="text-brand-gray-400">📍 {card.event_location}</span>
        ) : null}
        {card.pay_info ? (
          <span className="font-semibold text-emerald-300">
            💵 {card.pay_info}
          </span>
        ) : null}
      </div>

      {/* ── Genre chips ─────────────────────────────────────────────── */}
      {card.genres.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.genres.slice(0, 5).map((g) => (
            <span
              key={g}
              className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-brand-gray-300"
            >
              {g}
            </span>
          ))}
          {card.genres.length > 5 ? (
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium text-brand-gray-400">
              +{card.genres.length - 5}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* ── Footer CTA hint ─────────────────────────────────────────── */}
      <div className="mt-4 flex items-center justify-end border-t border-white/5 pt-3">
        <span className="text-xs font-semibold text-brand-gray-400 transition group-hover:text-brand-orange">
          View &amp; respond →
        </span>
      </div>
    </Link>
  );
}

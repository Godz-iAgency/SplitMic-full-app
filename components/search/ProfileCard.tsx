import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PLAYER_TYPE_OPTIONS } from "@/lib/types";
import type { SearchCard } from "@/lib/supabase/search";
import { PlayerTypeIcon } from "@/components/landing/PlayerTypeIcon";

type Props = {
  card: SearchCard;
};

export function ProfileCard({ card }: Props) {
  const option = PLAYER_TYPE_OPTIONS.find((o) => o.value === card.player_type);
  const typeLabel = option?.label ?? card.player_type;
  const initial = card.display_name.charAt(0).toUpperCase();
  const genres = card.genres.slice(0, 3);

  return (
    <Link
      href={`/profile/${card.profile_id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-gray-900 to-black transition-all duration-200 hover:-translate-y-1 hover:border-brand-orange/40 hover:shadow-xl hover:shadow-brand-orange/10"
    >
      {/* Accent strip */}
      <div className="h-1 w-full bg-gradient-to-r from-brand-orange via-brand-orange/60 to-transparent" />

      <div className="flex flex-1 flex-col p-5">
        {/* Avatar + name */}
        <div className="flex items-start gap-3.5">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-gray-800 to-brand-gray-900 ring-1 ring-white/10 transition group-hover:ring-brand-orange/40">
            {card.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.avatar_url}
                alt={card.display_name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-orange/20 to-brand-orange/5 text-2xl font-bold text-brand-orange">
                {initial}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-base font-bold leading-snug text-white transition group-hover:text-brand-orange">
              {card.display_name}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-orange">
              <PlayerTypeIcon
                type={card.player_type}
                className="h-3 w-3"
                strokeWidth={2.5}
              />
              {typeLabel}
            </div>
          </div>
        </div>

        {/* One-liner */}
        {card.one_liner ? (
          <p className="mt-3.5 line-clamp-2 text-sm leading-relaxed text-brand-gray-300">
            {card.one_liner}
          </p>
        ) : null}

        {/* Genre chips */}
        {genres.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <span
                key={g}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-brand-gray-300"
              >
                {g}
              </span>
            ))}
          </div>
        ) : null}

        {/* View profile cue */}
        <div className="mt-auto flex items-center gap-1 pt-4 text-sm font-semibold text-brand-gray-400 transition group-hover:text-brand-orange">
          View profile
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

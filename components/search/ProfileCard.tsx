import Link from "next/link";
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

  return (
    <Link
      href={`/profile/${card.profile_id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-gray-900 to-black p-5 transition-all duration-200 hover:-translate-y-1 hover:border-brand-orange/40 hover:shadow-lg hover:shadow-brand-orange/20"
    >
      {/* Player type pill at top */}
      <div className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-brand-orange/30 bg-brand-orange/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-orange">
        <PlayerTypeIcon
          type={card.player_type}
          className="h-3 w-3"
          strokeWidth={2.5}
        />
        {typeLabel}
      </div>

      {/* Avatar + name row */}
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-brand-gray-800 to-brand-gray-900 ring-2 ring-white/10 transition group-hover:ring-brand-orange/40">
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
          <h3 className="line-clamp-2 text-lg font-bold leading-snug text-white transition group-hover:text-brand-orange">
            {card.display_name}
          </h3>
        </div>
      </div>

      {card.one_liner ? (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-brand-gray-300">
          {card.one_liner}
        </p>
      ) : null}
    </Link>
  );
}

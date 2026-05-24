import Link from "next/link";
import { PLAYER_TYPE_OPTIONS } from "@/lib/types";
import type { SearchCard } from "@/lib/supabase/search";

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
      className="group flex h-full flex-col rounded-xl border border-white/5 bg-white/5 p-4 transition hover:border-brand-orange/40 hover:bg-brand-gray-900/80"
    >
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-brand-gray-900 ring-1 ring-white/10">
          {card.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.avatar_url}
              alt={card.display_name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-bold text-brand-orange">
              {initial}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-orange">
            {typeLabel}
          </p>
          <h3 className="truncate text-base font-semibold text-white group-hover:text-brand-orange">
            {card.display_name}
          </h3>
        </div>
      </div>

      {card.one_liner ? (
        <p className="mt-3 line-clamp-2 text-sm text-brand-gray-300">
          {card.one_liner}
        </p>
      ) : null}
    </Link>
  );
}

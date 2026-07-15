import Link from "next/link";
import { Zap, ArrowRight } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { PlayerTypeIcon } from "./PlayerTypeIcon";
import { PLAYER_TYPE_OPTIONS, type PlayerType } from "@/lib/types";
import type { SearchCard } from "@/lib/supabase/search";

export type TeaserCounts = Record<PlayerType | "all", number>;

type Props = {
  counts: TeaserCounts | null;
  cards: SearchCard[];
};

// Don't advertise an empty room — weak social proof is worse than none.
// The section simply doesn't render until the scene has real density.
const MIN_PROFILES_TO_SHOW = 6;
const MIN_CARDS_TO_SHOW = 3;

/**
 * Reciprocity: show real (published) inventory BEFORE asking for a signup.
 * Every card links to /signup — the gate sits at the moment of demonstrated
 * value, not before it. Counts and cards are live data, never fabricated.
 */
export function SceneTeaserSection({ counts, cards }: Props) {
  if (
    !counts ||
    counts.all < MIN_PROFILES_TO_SHOW ||
    cards.length < MIN_CARDS_TO_SHOW
  ) {
    return null;
  }

  const countLine = [
    counts.band > 0 ? `${counts.band} bands` : null,
    counts.venue > 0 ? `${counts.venue} venues` : null,
    counts.talent_buyer > 0 ? `${counts.talent_buyer} talent buyers` : null,
    counts.record_label > 0 ? `${counts.record_label} labels` : null,
    counts.festival > 0 ? `${counts.festival} festivals` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="border-t border-brand-gray-800 bg-black px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-12 text-center">
          <h2 className="text-3xl font-black sm:text-5xl">
            This is <span className="text-brand-orange">the room</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-brand-gray-300">
            {countLine} — live on SplitMic right now.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, i) => {
            const typeLabel =
              PLAYER_TYPE_OPTIONS.find((o) => o.value === card.player_type)
                ?.label ?? card.player_type;
            return (
              <Reveal key={card.profile_id} delay={Math.min(i, 5) * 0.05}>
                <Link
                  href="/signup"
                  className="group flex items-center gap-4 rounded-2xl border border-brand-gray-800 bg-brand-gray-900/50 p-4 transition hover:-translate-y-0.5 hover:border-brand-orange/50 hover:bg-brand-gray-900"
                >
                  {card.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.avatar_url}
                      alt=""
                      className="h-14 w-14 flex-shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-orange/25 to-brand-gray-900 text-brand-orange ring-1 ring-white/10">
                      <PlayerTypeIcon
                        type={card.player_type}
                        className="h-6 w-6"
                        strokeWidth={1.75}
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-white">
                        {card.display_name}
                      </p>
                      {card.readiness_score !== null ? (
                        <span className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-full bg-brand-orange/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-orange">
                          <Zap
                            className="h-2.5 w-2.5"
                            strokeWidth={2.5}
                            aria-hidden="true"
                          />
                          {card.readiness_score}/10
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand-gray-400">
                      {typeLabel}
                    </p>
                    {card.genres.length > 0 ? (
                      <p className="mt-1 truncate text-xs text-brand-gray-300">
                        {card.genres.slice(0, 3).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-10 text-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl border border-brand-orange/40 bg-brand-orange/10 px-8 py-4 text-base font-bold text-brand-orange transition hover:bg-brand-orange hover:text-white"
          >
            Create a free profile to connect with them
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              strokeWidth={2.25}
              aria-hidden="true"
            />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

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

// The full card grid needs real density — a sparse 1–2 card row reads as
// "nobody's here." Below this, we fall back to a "get in early" framing that
// still shows the real counts (honest social proof) without the thin grid.
const MIN_CARDS_FOR_GRID = 3;

/**
 * Reciprocity: show real (published) inventory BEFORE asking for a signup.
 * Every card links to /signup — the gate sits at the moment of demonstrated
 * value, not before it. Counts and cards are live data, never fabricated.
 *
 * Cold-start aware:
 *   - 0 published profiles  → render nothing (no empty room to advertise).
 *   - 1 to (grid-1)         → "get in early" framing + real counts, no grid.
 *   - grid+                 → full "this is the room" card grid.
 */
export function SceneTeaserSection({ counts, cards }: Props) {
  // Nothing real to show yet.
  if (!counts || counts.all === 0) return null;

  const countLine = [
    counts.band > 0 ? plural(counts.band, "band") : null,
    counts.venue > 0 ? plural(counts.venue, "venue") : null,
    counts.talent_buyer > 0
      ? plural(counts.talent_buyer, "talent buyer")
      : null,
    counts.record_label > 0 ? plural(counts.record_label, "label") : null,
    counts.festival > 0 ? plural(counts.festival, "festival") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const hasGrid = cards.length >= MIN_CARDS_FOR_GRID;

  return (
    <section className="border-t border-brand-gray-800 bg-black px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-12 text-center">
          <h2 className="text-3xl font-black sm:text-5xl">
            {hasGrid ? (
              <>
                This is <span className="text-brand-orange">the room</span>
              </>
            ) : (
              <>
                Get in <span className="text-brand-orange">early</span>
              </>
            )}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-brand-gray-300">
            {hasGrid
              ? `${countLine}, live on SplitMic right now.`
              : `${countLine} already here. Be one of the first Austin sees.`}
          </p>
        </Reveal>

        {hasGrid ? (
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
        ) : null}

        <Reveal className="mt-10 text-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl border border-brand-orange/40 bg-brand-orange/10 px-8 py-4 text-base font-bold text-brand-orange transition hover:bg-brand-orange hover:text-white"
          >
            {hasGrid
              ? "Create a free profile to connect with them"
              : "Claim your free founding profile"}
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

/** "1 band" / "3 bands" — pluralize the label unless it ends in a special case. */
function plural(n: number, label: string): string {
  return `${n} ${label}${n === 1 ? "" : "s"}`;
}

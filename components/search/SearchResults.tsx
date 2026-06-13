"use client";

import { useRef, useState, useTransition } from "react";
import { ProfileCard } from "./ProfileCard";
import { Reveal } from "@/components/motion/Reveal";
import type { SearchCard, SortOption } from "@/lib/supabase/search";
import type { PlayerType } from "@/lib/types";
import { loadMoreSearchResults } from "@/app/search/actions";

type Props = {
  initialCards: SearchCard[];
  initialHasMore: boolean;
  playerType: PlayerType | "all";
  query?: string;
  genre?: string;
  sort?: SortOption;
};

export function SearchResults({
  initialCards,
  initialHasMore,
  playerType,
  query,
  genre,
  sort,
}: Props) {
  const [cards, setCards] = useState<SearchCard[]>(initialCards);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Capture original first-page values so "Show less" can revert to them.
  const originalCards = useRef(initialCards);
  const originalHasMore = useRef(initialHasMore);

  const isExpanded = cards.length > originalCards.current.length;

  function handleLoadMore() {
    startTransition(async () => {
      try {
        setError(null);
        const result = await loadMoreSearchResults(
          { playerType, query, genre, sort },
          cards.length,
        );
        setCards((prev) => [...prev, ...result.cards]);
        setHasMore(result.hasMore);
      } catch {
        setError("Couldn't load more results. Try again.");
      }
    });
  }

  function handleCollapse() {
    setCards(originalCards.current);
    setHasMore(originalHasMore.current);
    setError(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // When only a few results exist, cap the grid width + columns so a lone card
  // doesn't float in a wide empty void — keeps the layout looking deliberate.
  const count = cards.length;
  const gridClass =
    count <= 1
      ? "mx-auto max-w-sm grid-cols-1"
      : count === 2
        ? "mx-auto max-w-2xl grid-cols-1 sm:grid-cols-2"
        : count === 3
          ? "mx-auto max-w-5xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";

  return (
    <>
      <div className={`grid gap-4 ${gridClass}`}>
        {cards.map((card, i) => (
          <Reveal
            key={card.profile_id}
            delay={Math.min(i, 8) * 0.05}
            className="h-full"
          >
            <ProfileCard card={card} />
          </Reveal>
        ))}
      </div>

      {hasMore || isExpanded ? (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {hasMore ? (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isPending}
              className="rounded-full border border-white/15 bg-white/5 px-8 py-2.5 text-sm font-semibold text-white transition hover:border-brand-orange/40 hover:bg-white/10 disabled:opacity-50"
            >
              {isPending ? "Loading…" : "Load more"}
            </button>
          ) : null}

          {isExpanded ? (
            <button
              type="button"
              onClick={handleCollapse}
              className="rounded-full border border-white/15 bg-transparent px-6 py-2.5 text-sm font-medium text-brand-gray-300 transition hover:bg-white/5 hover:text-white"
            >
              Show less
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 text-center text-sm text-red-400"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}

"use client";

import { useState, useTransition, useRef } from "react";
import { OpportunityCard } from "./OpportunityCard";
import { loadMoreMarketplace } from "@/app/opportunities/actions";
import type {
  MarketplaceCard,
  BrowseFilters,
} from "@/lib/supabase/marketplace";

type Props = {
  initialCards: MarketplaceCard[];
  initialHasMore: boolean;
  filters: BrowseFilters;
};

export function MarketplaceList({
  initialCards,
  initialHasMore,
  filters,
}: Props) {
  const [cards, setCards] = useState<MarketplaceCard[]>(initialCards);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const originalCards = useRef(initialCards);
  const originalHasMore = useRef(initialHasMore);

  const isExpanded = cards.length > originalCards.current.length;

  function handleLoadMore() {
    startTransition(async () => {
      try {
        setError(null);
        const result = await loadMoreMarketplace(filters, cards.length);
        setCards((prev) => [...prev, ...result.cards]);
        setHasMore(result.hasMore);
      } catch {
        setError("Couldn't load more posts. Try again.");
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

  return (
    <>
      <div className="flex flex-col gap-4">
        {cards.map((c) => (
          <OpportunityCard key={c.id} card={c} />
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
        <p role="alert" className="mt-4 text-center text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </>
  );
}

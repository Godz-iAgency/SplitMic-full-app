"use client";

import { useState } from "react";
import type { DirectoryCard } from "@/lib/directory/queries";
import { BusinessCard } from "./BusinessCard";

/** How many grid cards are visible before "Show all". */
const INITIAL_VISIBLE = 48;

/** At most this many spotlight listings get the full-width treatment. */
const MAX_SPOTLIGHT = 3;

type Props = {
  cards: DirectoryCard[];
  /** Plural noun for the "Show all N …" button, e.g. "venues". */
  noun: string;
};

/**
 * Renders EVERY card into the HTML and merely hides the overflow with CSS.
 *
 * Slicing the array instead would keep hundreds of businesses out of the
 * server-rendered markup entirely, which for a page whose whole purpose is
 * search visibility would mean Google never sees most of the directory.
 */
export function DirectoryListing({ cards, noun }: Props) {
  const [expanded, setExpanded] = useState(false);

  const spotlight = cards.filter((c) => c.tier === "spotlight").slice(0, MAX_SPOTLIGHT);
  const spotlightIds = new Set(spotlight.map((c) => c.id));
  const rest = cards.filter((c) => !spotlightIds.has(c.id));

  const hiddenCount = Math.max(0, rest.length - INITIAL_VISIBLE);

  return (
    <div className="space-y-6">
      {spotlight.length > 0 ? (
        <div className="space-y-4">
          {spotlight.map((card) => (
            <BusinessCard key={card.id} card={card} />
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((card, index) => (
          <div
            key={card.id}
            className={
              !expanded && index >= INITIAL_VISIBLE
                ? "hidden"
                : card.tier === "featured"
                  ? "h-full sm:col-span-2"
                  : "h-full"
            }
          >
            <BusinessCard card={card} />
          </div>
        ))}
      </div>

      {hiddenCount > 0 ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-brand-orange/40 hover:text-brand-orange"
          >
            {expanded ? "Show less" : `Show all ${cards.length} ${noun}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { X } from "lucide-react";
import type { PlayerType } from "@/lib/types";
import { PlayerTypeIcon } from "@/components/landing/PlayerTypeIcon";

type FilterValue = PlayerType | "all";

const TILES: { value: PlayerType; label: string }[] = [
  { value: "band", label: "Bands" },
  { value: "venue", label: "Venues" },
  { value: "talent_buyer", label: "Talent Buyers" },
  { value: "record_label", label: "Labels" },
  { value: "festival", label: "Festivals" },
];

type Props = {
  active: FilterValue;
  counts: Record<PlayerType | "all", number>;
  query: string;
};

/**
 * Airbnb-style category browser with three render modes so the big tile grid
 * never buries the actual results on mobile:
 *
 *  1. Browse (active "all", no text query) → full tile grid (pick a category).
 *  2. Category picked (active is a specific type) → collapses to one compact
 *     chip so results jump to the top; the chip's × drops the category filter
 *     (keeping any text query) and reopens the grid.
 *  3. Searching by name across all types (active "all" + a text query) → hidden
 *     entirely; the results are what matters, the grid would just be dead space.
 */
export function CategoryTiles({ active, counts, query }: Props) {
  // Mode 2 — a specific category is selected: show the collapsed chip.
  if (active !== "all") {
    const activeTile = TILES.find((t) => t.value === active);
    // × removes just the category filter; preserve a text query if present.
    const clearHref = query.trim()
      ? `/search?q=${encodeURIComponent(query.trim())}`
      : "/search";

    return (
      <div className="flex items-center gap-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-gray-400">
          Showing
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-orange/40 bg-brand-orange/10 py-1.5 pl-2 pr-1.5 text-sm font-semibold text-white">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-orange text-black">
            <PlayerTypeIcon type={active} className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          {activeTile?.label ?? active}
          <span className="text-brand-gray-400" aria-hidden="true">
            ·
          </span>
          <span className="text-brand-gray-300">{counts[active] ?? 0}</span>
          <Link
            href={clearHref}
            scroll={false}
            aria-label="Show all categories"
            className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-full text-brand-gray-300 transition hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          </Link>
        </span>
      </div>
    );
  }

  // Mode 3 — searching by name across everyone: hide the grid, let results lead.
  if (query.trim()) {
    return null;
  }

  // Mode 1 — pure browse: the full tile grid. (No "Show all" link — the browse
  // state already lists everyone below, so it would be a no-op.)
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-gray-400">
        Browse by category
      </h2>

      {/* flex-wrap + justify-center keeps every tile the same size and centers
          the lone 5th tile instead of leaving an empty grid hole. gap-3 = 0.75rem:
          2-up → basis calc(50% - 0.375rem); 5-up → basis calc(20% - 0.6rem).
          Tiles are compact (icon beside label) on mobile so all five fit on
          screen at once; they expand to taller stacked cards at lg. */}
      <nav
        aria-label="Browse by player type"
        className="flex flex-wrap justify-center gap-3"
      >
        {TILES.map((t) => {
          const count = counts[t.value] ?? 0;

          return (
            <Link
              key={t.value}
              href={`/search?type=${t.value}`}
              scroll={false}
              className="group flex shrink-0 grow-0 basis-[calc(50%-0.375rem)] flex-row items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition-all duration-200 hover:border-brand-orange/40 hover:bg-white/10 lg:basis-[calc(20%-0.6rem)] lg:flex-col lg:items-start lg:gap-3 lg:p-4 lg:hover:-translate-y-0.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange transition group-hover:bg-brand-orange/20 lg:h-11 lg:w-11">
                <PlayerTypeIcon
                  type={t.value}
                  className="h-[18px] w-[18px] lg:h-5 lg:w-5"
                  strokeWidth={2}
                />
              </span>

              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">
                  {t.label}
                </p>
                <p className="mt-0.5 text-xs text-brand-gray-400">
                  {count} {count === 1 ? "profile" : "profiles"}
                </p>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

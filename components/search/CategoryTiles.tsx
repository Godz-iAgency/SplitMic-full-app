import Link from "next/link";
import { X } from "lucide-react";
import type { PlayerType } from "@/lib/types";
import { CATEGORY_META } from "@/lib/directory/categories";
import { PlayerTypeIcon } from "@/components/landing/PlayerTypeIcon";

type FilterValue = PlayerType | "all";

// Same eight categories, in the same order, as the directory's own tiles, and
// the same photos (CATEGORY_META), so Discover and the directory read as one
// product. Labels are shortened where the directory's plural would truncate
// in a half-width phone tile.
const TILES: { value: PlayerType; label: string }[] = [
  { value: "band", label: "Bands" },
  { value: "venue", label: "Venues" },
  { value: "talent_buyer", label: "Talent Buyers" },
  { value: "record_label", label: "Labels" },
  { value: "festival", label: "Festivals" },
  { value: "backline", label: "Backline" },
  { value: "instrument_rental", label: "Instrument Rental" },
  { value: "rehearsal_studio", label: "Rehearsal Studios" },
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

      {/* Eight tiles: two to a row as compact photo-beside-label rows on phones
          and tablets (four short rows, so results still start near the top),
          then four to a row as photo cards at lg. gap-3 = 0.75rem: 2-up →
          basis calc(50% - 0.375rem); 4-up → basis calc(25% - 0.5625rem).
          Below sm, every tile gets the two-line height: "Instrument Rental"
          and friends wrap at phone width, and without it the rows alternate
          between two heights. From sm up every label fits on one line. */}
      <nav
        aria-label="Browse by player type"
        className="flex flex-wrap justify-center gap-3"
      >
        {TILES.map((t) => {
          const count = counts[t.value] ?? 0;
          const image = CATEGORY_META[t.value].image;

          return (
            <Link
              key={t.value}
              href={`/search?type=${t.value}`}
              scroll={false}
              className="tappable-lg group flex min-h-[80px] shrink-0 grow-0 basis-[calc(50%-0.375rem)] flex-row items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2 hover:border-brand-orange/40 hover:bg-white/10 sm:min-h-[56px] lg:basis-[calc(25%-0.5625rem)] lg:flex-col lg:items-stretch lg:gap-0 lg:p-0 lg:hover:-translate-y-0.5"
            >
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt=""
                  loading="lazy"
                  className="h-10 w-10 shrink-0 rounded-xl object-cover lg:h-24 lg:w-full lg:rounded-none"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange lg:h-24 lg:w-full lg:rounded-none">
                  <PlayerTypeIcon type={t.value} className="h-5 w-5" strokeWidth={2} />
                </span>
              )}

              <div className="min-w-0 lg:px-4 lg:py-3">
                <p className="text-sm font-bold leading-tight text-white">
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

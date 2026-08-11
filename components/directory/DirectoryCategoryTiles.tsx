import Link from "next/link";
import { X } from "lucide-react";
import {
  CATEGORY_META,
  DIRECTORY_CATEGORIES,
  type DirectoryCategory,
} from "@/lib/directory/categories";
import { DirectoryCategoryIcon } from "./DirectoryCategoryIcon";

type Props = {
  active: DirectoryCategory | "all";
  counts: Record<DirectoryCategory | "all", number>;
  query: string;
};

/**
 * Adapted from components/search/CategoryTiles for the 8 directory categories.
 * Same three render modes, so the tile grid never buries the actual results:
 *
 *  1. Browsing (no category, no query) -> the full tile grid.
 *  2. A category is open -> collapses to one chip whose x returns to the hub.
 *  3. Free-text searching -> hidden; the results are what matters.
 */
export function DirectoryCategoryTiles({ active, counts, query }: Props) {
  if (active !== "all") {
    const meta = CATEGORY_META[active];
    const clearHref = query.trim()
      ? `/directory?q=${encodeURIComponent(query.trim())}`
      : "/directory";

    return (
      <div className="flex items-center gap-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-gray-400">
          Showing
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-orange/40 bg-brand-orange/10 py-1.5 pl-2 pr-1.5 text-sm font-semibold text-white">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-orange text-black">
            <DirectoryCategoryIcon
              category={active}
              className="h-3.5 w-3.5"
              strokeWidth={2.5}
            />
          </span>
          {meta.plural}
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

  if (query.trim()) return null;

  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-gray-400">
        Browse by category
      </h2>

      {/* Photo tiles, matching the landing page's player cards so the directory
          reads as the same product rather than a bolted-on list. The three
          categories with no player-type photo fall back to a brand gradient. */}
      <nav
        aria-label="Browse the directory by category"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {DIRECTORY_CATEGORIES.map((category) => {
          const meta = CATEGORY_META[category];
          const count = counts[category] ?? 0;

          return (
            <Link
              key={category}
              href={`/directory/${meta.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-brand-gray-900/50 transition-all duration-200 hover:border-brand-orange/40 hover:shadow-lg hover:shadow-brand-orange/10 lg:hover:-translate-y-0.5"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden">
                {meta.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={meta.image}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-brand-orange/25 via-brand-gray-900 to-black" />
                )}

                {/* Fades the photo into the card body. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-brand-gray-900 via-brand-gray-900/30 to-transparent"
                />

                <div className="absolute bottom-2 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-2xl border border-brand-orange/40 bg-black/70 text-brand-orange shadow-lg shadow-black/40 backdrop-blur transition group-hover:scale-110">
                  <DirectoryCategoryIcon
                    category={category}
                    className="h-5 w-5"
                    strokeWidth={1.75}
                  />
                </div>
              </div>

              <div className="px-3 pb-3 pt-2 text-center">
                <p className="truncate text-sm font-bold text-white">
                  {meta.plural}
                </p>
                <p className="mt-0.5 text-xs text-brand-gray-400">
                  {count} listed
                </p>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

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
          <span className="text-brand-gray-500" aria-hidden="true">
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

      <nav
        aria-label="Browse the directory by category"
        className="flex flex-wrap justify-center gap-3"
      >
        {DIRECTORY_CATEGORIES.map((category) => {
          const meta = CATEGORY_META[category];
          const count = counts[category] ?? 0;

          return (
            <Link
              key={category}
              href={`/directory/${meta.slug}`}
              className="group flex shrink-0 grow-0 basis-[calc(50%-0.375rem)] flex-row items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition-all duration-200 hover:border-brand-orange/40 hover:bg-white/10 lg:basis-[calc(25%-0.5625rem)] lg:flex-col lg:items-start lg:gap-3 lg:p-4 lg:hover:-translate-y-0.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange transition group-hover:bg-brand-orange/20 lg:h-11 lg:w-11">
                <DirectoryCategoryIcon
                  category={category}
                  className="h-[18px] w-[18px] lg:h-5 lg:w-5"
                  strokeWidth={2}
                />
              </span>

              <div className="min-w-0">
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

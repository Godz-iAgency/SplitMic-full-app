import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import { SearchBox } from "@/components/search/SearchBox";
import { DirectorySubcategoryFilter } from "./DirectorySubcategoryFilter";

type Props = {
  /** Rows matching the current filters. */
  shown: number;
  /** Rows in this category with no filters applied. */
  total: number;
  /** Plural noun, e.g. "venues". */
  noun: string;
  subcategoryOptions: string[];
  subcategoryAllLabel: string;
  /** Where "Reset" clears back to. */
  resetHref: string;
  hasFilters: boolean;
};

/**
 * Search + subcategory filter + result count, in the panel treatment a
 * directory is expected to have. Server component: the two interactive pieces
 * inside it are their own client components, so the count and chrome stay in
 * the server-rendered HTML.
 */
export function DirectoryFilterBar({
  shown,
  total,
  noun,
  subcategoryOptions,
  subcategoryAllLabel,
  resetHref,
  hasFilters,
}: Props) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-gray-400">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Filter listings
        </h2>

        <p className="text-sm text-brand-gray-300">
          {hasFilters ? (
            <>
              Showing <span className="font-bold text-white">{shown}</span> of{" "}
              {total} {noun}
            </>
          ) : (
            <>
              <span className="font-bold text-white">{total}</span> {noun}
            </>
          )}
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <SearchBox />
        </div>

        <DirectorySubcategoryFilter
          options={subcategoryOptions}
          allLabel={subcategoryAllLabel}
          ariaLabel={`Filter ${noun} by type`}
        />

        {hasFilters ? (
          <Link
            href={resetHref}
            scroll={false}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-brand-gray-300 transition hover:border-brand-orange/40 hover:text-brand-orange"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Reset
          </Link>
        ) : null}
      </div>
    </section>
  );
}

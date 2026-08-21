import type { Metadata } from "next";
import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  getDirectoryBusinesses,
  getDirectoryCounts,
  type DirectoryCard,
} from "@/lib/directory/queries";
import type { DirectoryCategory } from "@/lib/directory/categories";
import { SearchBox } from "@/components/search/SearchBox";
import { DirectoryCategoryTiles } from "@/components/directory/DirectoryCategoryTiles";
import { DirectoryListing } from "@/components/directory/DirectoryListing";
import { DirectoryEmptyState } from "@/components/directory/DirectoryEmptyState";
import { BackToHomeLink } from "@/components/directory/BackToHomeLink";

// Public page — no login. Directory data only changes on a manual import,
// so an hour of caching is plenty.
export const revalidate = 3600;

// Titled "Directory" rather than plain "Austin Live Music": /live already owns
// that exact phrase, and two pages competing for it would split the ranking
// signal instead of concentrating it. Both carry the keyword, different intent.
export const metadata: Metadata = {
  title: "Austin Live Music Directory",
  description:
    "A curated directory of Austin's music industry: venues, bands, talent buyers, record labels, festivals, rehearsal studios, instrument rental, and backline.",
  alternates: { canonical: "/directory" },
  openGraph: {
    title: "Austin Live Music Directory | SplitMic",
    description:
      "Venues, bands, talent buyers, labels, festivals, studios, and gear: the Austin music industry in one place.",
    type: "website",
  },
};

const EMPTY_COUNTS = {} as Record<DirectoryCategory | "all", number>;

export default async function DirectoryHubPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const query = searchParams.q?.trim() ?? "";

  let counts = EMPTY_COUNTS;
  let results: DirectoryCard[] = [];
  try {
    const supabase = createServiceRoleClient();
    // Only run the search query when there's something to search for — the hub
    // is a category browser otherwise.
    [counts, results] = await Promise.all([
      getDirectoryCounts(supabase),
      query
        ? getDirectoryBusinesses(supabase, { query })
        : Promise.resolve<DirectoryCard[]>([]),
    ]);
  } catch {
    // Missing env or a query failure renders the page shell rather than a 500.
  }

  return (
    <main className="min-h-screen bg-black px-4 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <BackToHomeLink />

        <header className="text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">
            Austin Live Music Directory
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-brand-gray-300">
            Venues, bands, talent buyers, labels, festivals, rehearsal studios,
            instrument rental, and backline: the people who actually make
            Austin&rsquo;s music scene run.
          </p>
        </header>

        <div className="flex justify-center">
          <div className="w-full max-w-xl">
            <SearchBox />
          </div>
        </div>

        <DirectoryCategoryTiles active="all" counts={counts} query={query} />

        {query ? (
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
              {results.length} {results.length === 1 ? "result" : "results"} for
              &ldquo;{query}&rdquo;
            </h2>
            {results.length === 0 ? (
              <DirectoryEmptyState
                mode="no-results"
                plural="businesses"
                query={query}
                clearHref="/directory"
              />
            ) : (
              <DirectoryListing cards={results} noun="results" />
            )}
          </section>
        ) : null}

        <p className="text-center text-sm text-brand-gray-400">
          Run one of these businesses?{" "}
          <Link href="/signup" className="text-brand-orange hover:underline">
            Claim your listing on SplitMic
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

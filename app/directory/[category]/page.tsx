import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  getDirectoryBusinesses,
  getDirectoryCounts,
  type DirectoryCard,
} from "@/lib/directory/queries";
import {
  CATEGORY_META,
  categoryFromSlug,
  type DirectoryCategory,
} from "@/lib/directory/categories";
import { SearchBox } from "@/components/search/SearchBox";
import { DirectoryCategoryTiles } from "@/components/directory/DirectoryCategoryTiles";
import { DirectoryListing } from "@/components/directory/DirectoryListing";
import { DirectoryEmptyState } from "@/components/directory/DirectoryEmptyState";
import { DirectoryFaqSection } from "@/components/directory/DirectoryFaqSection";
import { DirectoryCategoryJsonLd } from "@/components/directory/DirectoryJsonLd";

// Server-rendered and cached for an hour. Deliberately NOT using
// generateStaticParams: this page reads searchParams for its search box, which
// only exists per-request, and asking Next to prerender it anyway breaks
// next/link during the static pass. Crawlers get the same complete HTML either
// way — the cache does the work generateStaticParams would have.
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://splitmic.com";

export async function generateMetadata({
  params,
}: {
  params: { category: string };
}): Promise<Metadata> {
  const category = categoryFromSlug(params.category);
  if (!category) return { title: "Directory" };

  const meta = CATEGORY_META[category];
  return {
    title: meta.seoTitle,
    description: meta.blurb,
    alternates: { canonical: `/directory/${meta.slug}` },
    openGraph: {
      title: `${meta.seoTitle} | SplitMic`,
      description: meta.blurb,
      type: "website",
    },
  };
}

const EMPTY_COUNTS = {} as Record<DirectoryCategory | "all", number>;

export default async function DirectoryCategoryPage({
  params,
  searchParams,
}: {
  params: { category: string };
  searchParams: { q?: string };
}) {
  const category = categoryFromSlug(params.category);
  if (!category) notFound();

  const meta = CATEGORY_META[category];
  const query = searchParams.q?.trim() ?? "";

  let cards: DirectoryCard[] = [];
  let counts = EMPTY_COUNTS;
  try {
    const supabase = createServiceRoleClient();
    [cards, counts] = await Promise.all([
      getDirectoryBusinesses(supabase, { category, query: query || undefined }),
      getDirectoryCounts(supabase),
    ]);
  } catch {
    // Renders the page shell (heading, FAQ, structured data) rather than a 500.
  }

  return (
    <>
      <DirectoryCategoryJsonLd
        cards={cards}
        category={category}
        baseUrl={SITE_URL}
      />

      <main className="min-h-screen bg-black px-4 py-12 text-white sm:px-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1 text-sm text-brand-gray-400"
          >
            <Link href="/directory" className="hover:text-white">
              Directory
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-brand-gray-300">{meta.plural}</span>
          </nav>

          <header>
            <h1 className="text-3xl font-bold sm:text-4xl">{meta.seoTitle}</h1>
            <p className="mt-2 max-w-2xl text-brand-gray-300">{meta.blurb}</p>
          </header>

          <div className="space-y-4">
            <div className="max-w-xl">
              <SearchBox />
            </div>
            <DirectoryCategoryTiles
              active={category}
              counts={counts}
              query={query}
            />
          </div>

          {cards.length === 0 ? (
            query ? (
              <DirectoryEmptyState
                mode="no-results"
                plural={meta.plural}
                query={query}
                clearHref={`/directory/${meta.slug}`}
              />
            ) : (
              <DirectoryEmptyState mode="unbuilt" plural={meta.plural} />
            )
          ) : (
            <DirectoryListing
              cards={cards}
              noun={meta.plural.toLowerCase()}
            />
          )}

          <DirectoryFaqSection category={category} />

          <p className="text-center text-sm text-brand-gray-400">
            Run one of these businesses?{" "}
            <Link href="/signup" className="text-brand-orange hover:underline">
              Claim your listing on SplitMic
            </Link>
            .
          </p>
        </div>
      </main>
    </>
  );
}

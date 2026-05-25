import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import { searchProfiles, type SortOption } from "@/lib/supabase/search";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { InboxBell } from "@/components/inbox/InboxBell";
import { AdminLink } from "@/components/admin/AdminLink";
import { WelcomeIntro } from "@/components/WelcomeIntro";
import { FilterPills } from "@/components/search/FilterPills";
import { SearchBox } from "@/components/search/SearchBox";
import { GenreFilter } from "@/components/search/GenreFilter";
import { SortDropdown } from "@/components/search/SortDropdown";
import { SearchResults } from "@/components/search/SearchResults";
import type { PlayerType } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set<string>([
  "all",
  "band",
  "venue",
  "talent_buyer",
  "record_label",
  "festival",
]);

const VALID_SORTS = new Set<SortOption>(["newest", "recent"]);

export default async function SearchPage({
  searchParams,
}: {
  searchParams: {
    type?: string;
    q?: string;
    genre?: string;
    sort?: string;
  };
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { profile, isComplete } = await getOnboardingStatus(supabase, user.id);
  if (!isComplete || !profile) redirect("/onboarding");

  // Parse + validate URL params
  const rawType = searchParams.type ?? "band";
  const activeType = (VALID_TYPES.has(rawType) ? rawType : "band") as
    | PlayerType
    | "all";

  const rawSort = (searchParams.sort ?? "newest") as SortOption;
  const activeSort: SortOption = VALID_SORTS.has(rawSort) ? rawSort : "newest";

  const queryText = searchParams.q?.trim() ?? "";
  const genre = searchParams.genre ?? "";

  const { cards, hasMore } = await searchProfiles(supabase, {
    playerType: activeType,
    query: queryText,
    genre,
    sort: activeSort,
  });

  // Build a unique key so SearchResults remounts on any filter change
  const searchKey = `${activeType}|${queryText}|${genre}|${activeSort}`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black pb-20">
      <WelcomeIntro />

      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 shadow-sm shadow-black/40 px-5 py-4 sm:px-8">
        <Link href="/search">
          <Logo className="text-2xl" />
        </Link>
        <nav className="hidden items-center gap-2 sm:flex">
          <Link
            href="/search"
            aria-current="page"
            className="rounded-full bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-orange/30"
          >
            Discover
          </Link>
          <Link
            href="/opportunities"
            className="rounded-full px-4 py-2 text-sm font-semibold text-brand-gray-400 transition hover:text-white"
          >
            Feed
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <AdminLink />
          <InboxBell />
          {profile.profile_id ? (
            <Link
              href={`/profile/${profile.profile_id}`}
              className="rounded-full border border-brand-orange/50 px-4 py-2 text-sm font-semibold text-brand-orange transition hover:bg-brand-orange hover:text-white"
            >
              My profile
            </Link>
          ) : null}
          <Link
            href="/profile/edit"
            className="hidden rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 sm:block"
          >
            Edit
          </Link>
          <LogoutButton />
        </div>
      </header>

      {/* Search section */}
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-6">
          <h1 className="text-3xl font-bold sm:text-4xl">
            Discover Austin&apos;s music ecosystem
          </h1>
          <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
            Browse bands, venues, talent buyers, labels, and festivals — all
            verified Austin.
          </p>
        </div>

        {/* Filter row 1: search box (full width on mobile, larger on desktop) */}
        <div className="mb-4">
          <SearchBox />
        </div>

        {/* Filter row 2: genre + sort */}
        <div className="mb-6 flex flex-wrap gap-3">
          <GenreFilter />
          <SortDropdown />
        </div>

        {/* Filter row 3: player-type pills */}
        <div className="mb-8">
          <FilterPills active={activeType} />
        </div>

        {cards.length === 0 ? (
          <EmptyState
            activeType={activeType}
            hasFilters={!!(queryText || genre)}
          />
        ) : (
          <SearchResults
            key={searchKey}
            initialCards={cards}
            initialHasMore={hasMore}
            playerType={activeType}
            query={queryText}
            genre={genre}
            sort={activeSort}
          />
        )}
      </section>
    </main>
  );
}

function EmptyState({
  activeType,
  hasFilters,
}: {
  activeType: PlayerType | "all";
  hasFilters: boolean;
}) {
  const labelMap: Record<string, string> = {
    all: "profiles",
    band: "bands",
    venue: "venues",
    talent_buyer: "talent buyers",
    record_label: "labels",
    festival: "festivals",
  };
  const label = labelMap[activeType] ?? "profiles";

  if (hasFilters) {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/5 p-10 text-center">
        <p className="text-2xl">🔍</p>
        <h2 className="mt-3 text-lg font-semibold text-white">
          No matching {label}
        </h2>
        <p className="mt-2 text-sm text-brand-gray-300">
          Try a different name, genre, or clear your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 p-10 text-center">
      <p className="text-2xl">🔭</p>
      <h2 className="mt-3 text-lg font-semibold text-white">
        No published {label} yet
      </h2>
      <p className="mt-2 text-sm text-brand-gray-300">
        SplitMic is brand new. Be one of the first to publish your profile and
        get found.
      </p>
      <Link
        href="/profile/edit"
        className="mt-6 inline-flex rounded-full bg-brand-orange px-5 py-2 text-sm font-semibold text-black transition hover:bg-brand-orange/90"
      >
        Complete my profile
      </Link>
    </div>
  );
}

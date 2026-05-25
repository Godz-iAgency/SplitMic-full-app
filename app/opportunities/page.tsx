import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import {
  browseMarketplace,
  isPostingPlayerType,
  type PostType,
} from "@/lib/supabase/marketplace";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { InboxBell } from "@/components/inbox/InboxBell";
import { AdminLink } from "@/components/admin/AdminLink";
import { PostTypeFilter } from "@/components/opportunities/PostTypeFilter";
import { MarketplaceGenreFilter } from "@/components/opportunities/MarketplaceGenreFilter";
import { MarketplaceSearchBox } from "@/components/opportunities/MarketplaceSearchBox";
import { MarketplaceList } from "@/components/opportunities/MarketplaceList";
import type { PlayerType } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_POST_TYPES = new Set<string>(["all", "event", "opportunity"]);

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: { type?: string; genre?: string; q?: string };
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, isComplete } = await getOnboardingStatus(supabase, user.id);
  if (!isComplete || !profile) redirect("/onboarding");

  const rawType = searchParams.type ?? "all";
  const activeType = (
    VALID_POST_TYPES.has(rawType) ? rawType : "all"
  ) as PostType | "all";
  const genre = searchParams.genre ?? "";
  const query = searchParams.q?.trim() ?? "";

  const filters = {
    postType: activeType,
    genre,
    query,
  };

  const { cards, hasMore } = await browseMarketplace(supabase, filters);

  const canPost = profile.player_type
    ? isPostingPlayerType(profile.player_type as PlayerType)
    : false;

  // Re-mount key so the list resets when filters change
  const listKey = `${activeType}|${genre}|${query}`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black pb-20">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 shadow-sm shadow-black/40 px-5 py-4 sm:px-8">
        <Link href="/search">
          <Logo className="text-2xl" />
        </Link>
        <nav className="hidden items-center gap-2 sm:flex">
          <Link
            href="/search"
            className="rounded-full px-4 py-2 text-sm font-semibold text-brand-gray-400 transition hover:text-white"
          >
            Discover
          </Link>
          <Link
            href="/opportunities"
            aria-current="page"
            className="rounded-full bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-orange/30"
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
          <LogoutButton />
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        {/* ── Header: title + create CTA ───────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">Feed</h1>
            <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
              What Austin&apos;s music scene is posting right now.
            </p>
          </div>

          {canPost ? (
            <Link
              href="/opportunities/new"
              className="rounded-full bg-brand-orange px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-brand-orange/90"
            >
              + Create post
            </Link>
          ) : null}
        </div>

        {/* Bands: subtle note instead of taking up space at the top */}
        {!canPost ? (
          <p className="mb-6 rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-xs text-brand-gray-300">
            💡 Bands browse the feed but don&apos;t post directly. Send a
            Connect request to a venue, label, talent buyer, or festival to
            start a conversation.
          </p>
        ) : null}

        {/* ── Filters: compact single area ──────────────────────────── */}
        <div className="mb-6 space-y-3 rounded-2xl border border-white/5 bg-white/[.03] p-4">
          <MarketplaceSearchBox />
          <div className="flex flex-wrap items-center gap-3">
            <PostTypeFilter active={activeType} />
            <div className="ml-auto">
              <MarketplaceGenreFilter />
            </div>
          </div>
        </div>

        {/* ── The feed itself ───────────────────────────────────────── */}
        {cards.length === 0 ? (
          <EmptyState hasFilters={!!(genre || query || activeType !== "all")} />
        ) : (
          <MarketplaceList
            key={listKey}
            initialCards={cards}
            initialHasMore={hasMore}
            filters={filters}
          />
        )}
      </section>
    </main>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  if (hasFilters) {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/5 p-10 text-center">
        <p className="text-2xl">🔍</p>
        <h2 className="mt-3 text-lg font-semibold text-white">
          No matching posts
        </h2>
        <p className="mt-2 text-sm text-brand-gray-300">
          Try a different search, genre, or clear your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 p-10 text-center">
      <p className="text-2xl">📭</p>
      <h2 className="mt-3 text-lg font-semibold text-white">
        The feed is quiet right now
      </h2>
      <p className="mt-2 text-sm text-brand-gray-300">
        Be the first to post. Music moves fast in Austin — get on the feed and
        get noticed.
      </p>
    </div>
  );
}

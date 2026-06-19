import Link from "next/link";
import { redirect } from "next/navigation";
import { Lightbulb, Search, Inbox } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import {
  browseMarketplace,
  isPostingPlayerType,
  type PostType,
} from "@/lib/supabase/marketplace";
import { AppHeader } from "@/components/AppHeader";
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
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black pb-24 lg:pb-20">
      <AppHeader active="feed" profileId={profile.profile_id} />

      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        {/* ── Header: title + create CTA ───────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Feed</h1>
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
          <p className="mb-6 inline-flex items-start gap-2 rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-xs text-brand-gray-300">
            <Lightbulb
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-orange"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span>
              Bands browse the feed but don&apos;t post directly. Send a
              Connect request to a venue, label, talent buyer, or festival to
              start a conversation.
            </span>
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
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange">
          <Search className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
        </div>
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
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange">
        <Inbox className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
      </div>
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

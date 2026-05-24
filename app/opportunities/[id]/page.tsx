import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import {
  getPostDetail,
  formatPostDate,
  formatEventDateRange,
} from "@/lib/supabase/marketplace";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { RespondPanel } from "@/components/opportunities/RespondPanel";
import { BandTagActions } from "@/components/opportunities/BandTagActions";
import { DeletePostButton } from "@/components/opportunities/DeletePostButton";
import { PLAYER_TYPE_OPTIONS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, isComplete } = await getOnboardingStatus(supabase, user.id);
  if (!isComplete || !profile) redirect("/onboarding");

  const { post, taggedBands } = await getPostDetail(supabase, params.id);
  if (!post) notFound();

  const isOwner = post.poster_user_id === user.id;
  const myProfileId = profile.profile_id;

  // Tag for the current viewing user (if they're tagged)
  const myTag = myProfileId
    ? taggedBands.find((t) => t.band_profile_id === myProfileId)
    : undefined;

  // Check if I've already responded to this post
  let alreadyResponded = false;
  if (myProfileId && !isOwner) {
    const { data: existing } = await supabase
      .from("connection_requests")
      .select("id")
      .eq("requester_profile_id", myProfileId)
      .eq("related_post_id", post.id)
      .maybeSingle();
    alreadyResponded = !!existing;
  }

  // Pending response count (owner only)
  let pendingResponseCount = 0;
  if (isOwner) {
    const { count } = await supabase
      .from("connection_requests")
      .select("id", { count: "exact", head: true })
      .eq("related_post_id", post.id)
      .eq("status", "pending");
    pendingResponseCount = count ?? 0;
  }

  const playerOption = PLAYER_TYPE_OPTIONS.find(
    (o) => o.value === post.poster_player_type,
  );

  const acceptedBands = taggedBands.filter((t) => t.status === "accepted");

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black pb-20">
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-4 sm:px-8">
        <Link href="/opportunities">
          <Logo className="text-2xl" />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/opportunities"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Back
          </Link>
          <LogoutButton />
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        {/* Post type + dates header */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
              post.post_type === "event"
                ? "bg-brand-orange/20 text-brand-orange"
                : "bg-blue-500/20 text-blue-300"
            }`}
          >
            {post.post_type === "event" ? "Event" : "Opportunity"}
          </span>
          {post.event_date ? (
            <span className="text-sm font-semibold text-white">
              📅 {formatEventDateRange(post.event_date, post.event_end_date)}
            </span>
          ) : null}
          {post.open_until ? (
            <span className="text-sm font-semibold text-white">
              Open until {formatPostDate(post.open_until)}
            </span>
          ) : null}
          <span className="text-xs text-brand-gray-400">
            Removes {formatPostDate(post.expires_at)}
          </span>
        </div>

        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          {post.title}
        </h1>

        {/* Poster card */}
        <div className="mt-4 flex items-center gap-3">
          <Link
            href={`/profile/${post.poster_profile_id}`}
            className="flex items-center gap-3 transition hover:opacity-80"
          >
            {post.poster_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.poster_avatar_url}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gray-800 text-sm font-bold text-brand-orange">
                {post.poster_name.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-semibold text-white">{post.poster_name}</p>
              <p className="text-xs text-brand-gray-400">
                {playerOption?.label ?? post.poster_player_type}
              </p>
            </div>
          </Link>
        </div>

        {/* Two-column layout: details left, action right */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {post.description ? (
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
                  About
                </h2>
                <p className="whitespace-pre-line text-base leading-relaxed text-brand-gray-100">
                  {post.description}
                </p>
              </section>
            ) : null}

            {post.event_location ? (
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
                  Location
                </h2>
                <p className="text-base text-white">📍 {post.event_location}</p>
              </section>
            ) : null}

            {post.pay_info ? (
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
                  Pay / deal
                </h2>
                <p className="text-base font-semibold text-emerald-300">
                  💵 {post.pay_info}
                </p>
              </section>
            ) : null}

            {post.genres.length > 0 ? (
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
                  Genres
                </h2>
                <div className="flex flex-wrap gap-2">
                  {post.genres.map((g) => (
                    <span
                      key={g}
                      className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {post.player_types_wanted.length > 0 ? (
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
                  Looking for
                </h2>
                <div className="flex flex-wrap gap-2">
                  {post.player_types_wanted.map((t) => {
                    const opt = PLAYER_TYPE_OPTIONS.find((p) => p.value === t);
                    return (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white"
                      >
                        <span>{opt?.icon ?? ""}</span>
                        {opt?.label ?? t}
                      </span>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* Lineup (event posts) */}
            {post.post_type === "event" && acceptedBands.length > 0 ? (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
                  Lineup
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {acceptedBands.map((b) => (
                    <Link
                      key={b.tag_id}
                      href={`/profile/${b.band_profile_id}`}
                      className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 p-3 transition hover:border-brand-orange/40 hover:bg-white/10"
                    >
                      {b.band_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.band_avatar_url}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gray-800 text-xs font-bold text-brand-orange">
                          {b.band_name.charAt(0)}
                        </div>
                      )}
                      <span className="truncate text-sm font-medium text-white">
                        {b.band_name}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Owner-only: pending tags status */}
            {isOwner && post.post_type === "event" && taggedBands.length > 0 ? (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
                  Tagged bands
                </h2>
                <ul className="space-y-2">
                  {taggedBands.map((b) => (
                    <li
                      key={b.tag_id}
                      className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-3"
                    >
                      {b.band_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.band_avatar_url}
                          alt=""
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gray-800 text-[11px] font-bold text-brand-orange">
                          {b.band_name.charAt(0)}
                        </div>
                      )}
                      <span className="flex-1 text-sm text-white">
                        {b.band_name}
                      </span>
                      <TagStatusBadge status={b.status} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          {/* Right column: action */}
          <aside className="space-y-4">
            {myTag ? (
              <BandTagActions
                tagId={myTag.tag_id}
                initialStatus={myTag.status}
                initialShared={myTag.shared_to_feed}
              />
            ) : null}

            <RespondPanel
              postId={post.id}
              alreadyResponded={alreadyResponded}
              isOwnPost={isOwner}
            />

            {isOwner ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-gray-400">
                  Owner tools
                </p>
                <p className="mt-2 text-sm text-white">
                  {pendingResponseCount} pending response
                  {pendingResponseCount === 1 ? "" : "s"}
                </p>
                <p className="mt-1 text-xs text-brand-gray-400">
                  Connection requests appear in your inbox (built in Step 5).
                </p>
                <div className="mt-4">
                  <DeletePostButton postId={post.id} />
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}

function TagStatusBadge({
  status,
}: {
  status: "pending" | "accepted" | "declined";
}) {
  const className =
    status === "accepted"
      ? "bg-emerald-500/20 text-emerald-300"
      : status === "declined"
        ? "bg-red-500/20 text-red-300"
        : "bg-white/10 text-brand-gray-300";
  const label =
    status === "accepted"
      ? "Accepted"
      : status === "declined"
        ? "Declined"
        : "Pending";
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${className}`}
    >
      {label}
    </span>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Calendar,
  MapPin,
  DollarSign,
  Music,
  Users,
  Pencil,
  Info,
  Clock,
  ListOrdered,
} from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import {
  getPostDetail,
  getOpenMicRoster,
  formatPostDate,
  formatEventDateRange,
} from "@/lib/supabase/marketplace";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { RespondPanel } from "@/components/opportunities/RespondPanel";
import { BandTagActions } from "@/components/opportunities/BandTagActions";
import { DeletePostButton } from "@/components/opportunities/DeletePostButton";
import { OpenMicSignupButton } from "@/components/opportunities/OpenMicSignupButton";
import { PlayerTypeIcon } from "@/components/landing/PlayerTypeIcon";
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
  const isBand = profile.player_type === "band";
  const isOpenMic = post.post_type === "open_mic";

  // Open mic roster (running order) — public, so everyone sees the lineup.
  const roster = isOpenMic ? await getOpenMicRoster(supabase, post.id) : [];
  const mySignup = roster.find((s) => s.band_user_id === user.id);

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

  const typeBg =
    post.post_type === "event"
      ? "bg-brand-orange/20 text-brand-orange border-brand-orange/30"
      : isOpenMic
        ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
        : "bg-blue-500/20 text-blue-300 border-blue-500/30";
  const typeLabel = isOpenMic
    ? "Open Mic"
    : post.post_type === "event"
      ? "Event"
      : "Opportunity";

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black pb-20">
      <header className="flex items-center justify-between border-b border-white/10 shadow-sm shadow-black/40 px-5 py-4 sm:px-8">
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

      <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        {/* ── HERO CARD: Post type, dates, title, poster ─────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-white/[.05] via-white/[.03] to-transparent p-6 shadow-lg shadow-black/40 sm:p-8">
          {/* Subtle orange glow accent */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-orange/10 blur-3xl"
          />

          {/* Top row: post type badge + dates */}
          <div className="relative mb-5 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] ${typeBg}`}
            >
              {typeLabel}
            </span>
            {post.event_date ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                <Calendar
                  className="h-4 w-4 text-brand-orange"
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
                {formatEventDateRange(post.event_date, post.event_end_date)}
              </span>
            ) : null}
            {post.open_until ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                <Clock
                  className="h-4 w-4 text-brand-orange"
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
                Open until {formatPostDate(post.open_until)}
              </span>
            ) : null}
            <span className="ml-auto text-xs text-brand-gray-400">
              Removes {formatPostDate(post.expires_at)}
            </span>
          </div>

          {/* Title */}
          <h1 className="relative text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            {post.title}
          </h1>

          {/* Poster identity card */}
          <Link
            href={`/profile/${post.poster_profile_id}`}
            className="relative mt-6 inline-flex items-center gap-4 rounded-xl border border-white/10 bg-black/40 p-3 pr-5 transition hover:border-brand-orange/40 hover:bg-black/60"
          >
            {post.poster_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.poster_avatar_url}
                alt=""
                className="h-14 w-14 rounded-lg object-cover ring-2 ring-white/10"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-brand-orange/30 to-brand-gray-900 text-xl font-bold text-brand-orange ring-2 ring-white/10">
                {post.poster_name.charAt(0)}
              </div>
            )}
            <div>
              <p className="text-base font-bold text-white">
                {post.poster_name}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-gray-400">
                {playerOption?.label ?? post.poster_player_type}
              </p>
            </div>
          </Link>
        </div>

        {/* ── Two-column layout: details left, action right ──────────── */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            {post.description ? (
              <SectionCard icon={<Info className="h-4 w-4" />} title="About">
                <p className="whitespace-pre-line text-base leading-relaxed text-brand-gray-100">
                  {post.description}
                </p>
              </SectionCard>
            ) : null}

            {post.event_location ? (
              <SectionCard
                icon={<MapPin className="h-4 w-4" />}
                title="Location"
              >
                <p className="text-base text-white">{post.event_location}</p>
              </SectionCard>
            ) : null}

            {post.pay_info ? (
              <SectionCard
                icon={<DollarSign className="h-4 w-4" />}
                title="Pay / Deal"
                accent="emerald"
              >
                <p className="text-lg font-bold text-emerald-300">
                  {post.pay_info}
                </p>
              </SectionCard>
            ) : null}

            {post.genres.length > 0 ? (
              <SectionCard
                icon={<Music className="h-4 w-4" />}
                title="Genres"
              >
                <div className="flex flex-wrap gap-2">
                  {post.genres.map((g) => (
                    <span
                      key={g}
                      className="rounded-full border border-white/15 bg-white/[.07] px-3 py-1 text-xs font-semibold text-white"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {post.player_types_wanted.length > 0 ? (
              <SectionCard
                icon={<Users className="h-4 w-4" />}
                title="Looking for"
              >
                <div className="flex flex-wrap gap-2">
                  {post.player_types_wanted.map((t) => {
                    const opt = PLAYER_TYPE_OPTIONS.find((p) => p.value === t);
                    return (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1.5 rounded-full border border-brand-orange/30 bg-brand-orange/10 px-3 py-1 text-xs font-semibold text-brand-orange"
                      >
                        {opt ? (
                          <PlayerTypeIcon
                            type={opt.value}
                            className="h-3.5 w-3.5"
                            strokeWidth={2}
                          />
                        ) : null}
                        {opt?.label ?? t}
                      </span>
                    );
                  })}
                </div>
              </SectionCard>
            ) : null}

            {/* Lineup (event posts) */}
            {post.post_type === "event" && acceptedBands.length > 0 ? (
              <SectionCard
                icon={<Music className="h-4 w-4" />}
                title="Lineup"
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {acceptedBands.map((b) => (
                    <Link
                      key={b.tag_id}
                      href={`/profile/${b.band_profile_id}`}
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-3 transition hover:border-brand-orange/40 hover:bg-black/60"
                    >
                      {b.band_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.band_avatar_url}
                          alt=""
                          className="h-9 w-9 rounded-lg object-cover ring-1 ring-white/10"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gray-800 text-xs font-bold text-brand-orange ring-1 ring-white/10">
                          {b.band_name.charAt(0)}
                        </div>
                      )}
                      <span className="truncate text-sm font-semibold text-white">
                        {b.band_name}
                      </span>
                    </Link>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {/* Open mic running order (public lineup) */}
            {isOpenMic && roster.length > 0 ? (
              <SectionCard
                icon={<ListOrdered className="h-4 w-4" />}
                title={`Running order · ${roster.length} ${
                  roster.length === 1 ? "band" : "bands"
                }`}
              >
                <ol className="space-y-2">
                  {roster.map((s, i) => (
                    <li
                      key={s.id}
                      className={`flex items-center gap-3 rounded-xl border p-3 ${
                        s.band_user_id === user.id
                          ? "border-purple-400/40 bg-purple-500/10"
                          : "border-white/10 bg-black/40"
                      }`}
                    >
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <Link
                        href={`/profile/${s.band_profile_id}`}
                        className="flex min-w-0 flex-1 items-center gap-2.5"
                      >
                        {s.band_avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.band_avatar_url}
                            alt=""
                            className="h-8 w-8 flex-shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                          />
                        ) : (
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-gray-800 text-xs font-bold text-purple-300 ring-1 ring-white/10">
                            {s.band_name.charAt(0)}
                          </div>
                        )}
                        <span className="truncate text-sm font-semibold text-white">
                          {s.band_name}
                        </span>
                      </Link>
                      {s.status === "checked_in" ? (
                        <span className="flex-shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                          Checked in
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </SectionCard>
            ) : null}

            {/* Owner-only: pending tags status */}
            {isOwner && post.post_type === "event" && taggedBands.length > 0 ? (
              <SectionCard
                icon={<Users className="h-4 w-4" />}
                title="Tagged bands"
              >
                <ul className="space-y-2">
                  {taggedBands.map((b) => (
                    <li
                      key={b.tag_id}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-3"
                    >
                      {b.band_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.band_avatar_url}
                          alt=""
                          className="h-9 w-9 rounded-lg object-cover ring-1 ring-white/10"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gray-800 text-xs font-bold text-brand-orange ring-1 ring-white/10">
                          {b.band_name.charAt(0)}
                        </div>
                      )}
                      <span className="flex-1 text-sm font-semibold text-white">
                        {b.band_name}
                      </span>
                      <TagStatusBadge status={b.status} />
                    </li>
                  ))}
                </ul>
              </SectionCard>
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

            {isOpenMic ? (
              !isOwner && isBand ? (
                <OpenMicSignupButton
                  postId={post.id}
                  initialSignedUp={!!mySignup}
                  position={mySignup?.sort_order ?? null}
                />
              ) : null
            ) : (
              <RespondPanel
                postId={post.id}
                alreadyResponded={alreadyResponded}
                isOwnPost={isOwner}
              />
            )}

            {isOwner ? (
              <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-white/[.05] via-white/[.03] to-transparent p-5 shadow-md shadow-black/30">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand-orange/10 blur-2xl"
                />
                <div className="relative">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">
                    Owner tools
                  </p>

                  {isOpenMic ? (
                    <>
                      <p className="mt-3 text-2xl font-bold text-white">
                        {roster.length}
                        <span className="ml-2 text-sm font-medium text-brand-gray-400">
                          band{roster.length === 1 ? "" : "s"} signed up
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-brand-gray-400">
                        Manage the running order and check bands in the night of.
                      </p>
                      <div className="mt-5 space-y-2">
                        <Link
                          href={`/opportunities/${post.id}/roster`}
                          className="flex w-full items-center justify-center gap-2 rounded-full bg-purple-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-purple-400"
                        >
                          <ListOrdered
                            className="h-3.5 w-3.5"
                            strokeWidth={2.5}
                            aria-hidden="true"
                          />
                          Manage lineup
                        </Link>
                        <Link
                          href={`/opportunities/${post.id}/edit`}
                          className="flex w-full items-center justify-center gap-2 rounded-full border border-brand-orange/40 bg-brand-orange/10 px-4 py-2.5 text-sm font-bold text-brand-orange transition hover:bg-brand-orange hover:text-white"
                        >
                          <Pencil
                            className="h-3.5 w-3.5"
                            strokeWidth={2.5}
                            aria-hidden="true"
                          />
                          Edit post
                        </Link>
                        <DeletePostButton postId={post.id} />
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mt-3 text-2xl font-bold text-white">
                        {pendingResponseCount}
                        <span className="ml-2 text-sm font-medium text-brand-gray-400">
                          pending response
                          {pendingResponseCount === 1 ? "" : "s"}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-brand-gray-400">
                        Responses appear in your inbox.
                      </p>

                      <div className="mt-5 space-y-2">
                        <Link
                          href={`/opportunities/${post.id}/edit`}
                          className="flex w-full items-center justify-center gap-2 rounded-full border border-brand-orange/40 bg-brand-orange/10 px-4 py-2.5 text-sm font-bold text-brand-orange transition hover:bg-brand-orange hover:text-white"
                        >
                          <Pencil
                            className="h-3.5 w-3.5"
                            strokeWidth={2.5}
                            aria-hidden="true"
                          />
                          Edit post
                        </Link>
                        <DeletePostButton postId={post.id} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────
// Section card — wraps each content block (About, Location, etc.)
// ────────────────────────────────────────────────────────────────────
function SectionCard({
  icon,
  title,
  children,
  accent = "orange",
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent?: "orange" | "emerald";
}) {
  const accentColor =
    accent === "emerald" ? "text-emerald-300" : "text-brand-orange";
  return (
    <section className="rounded-xl border border-white/10 bg-white/[.03] p-5 transition hover:border-white/20 sm:p-6">
      <h2
        className={`mb-3 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] ${accentColor}`}
      >
        <span>{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function TagStatusBadge({
  status,
}: {
  status: "pending" | "accepted" | "declined";
}) {
  const className =
    status === "accepted"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
      : status === "declined"
        ? "bg-red-500/20 text-red-300 border-red-500/30"
        : "bg-white/10 text-brand-gray-300 border-white/15";
  const label =
    status === "accepted"
      ? "Accepted"
      : status === "declined"
        ? "Declined"
        : "Pending";
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${className}`}
    >
      {label}
    </span>
  );
}

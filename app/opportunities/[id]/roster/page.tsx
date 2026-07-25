import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Calendar, MapPin, CheckCircle2 } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getPostDetail,
  getOpenMicRoster,
  formatEventDateRange,
} from "@/lib/supabase/marketplace";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { RosterList } from "@/components/opportunities/RosterList";

export const dynamic = "force-dynamic";

export default async function OpenMicRosterPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { post } = await getPostDetail(supabase, params.id);
  if (!post || post.post_type !== "open_mic") notFound();

  // Roster management is owner-only.
  if (post.poster_user_id !== user.id) {
    redirect(`/opportunities/${params.id}`);
  }

  const roster = await getOpenMicRoster(supabase, post.id);
  const checkedInCount = roster.filter((s) => s.status === "checked_in").length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black pb-20">
      <header className="flex items-center justify-between border-b border-white/10 shadow-sm shadow-black/40 px-5 py-4 sm:px-8">
        <Link href="/opportunities">
          <Logo className="text-2xl" />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/opportunities/${post.id}`}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Back to post
          </Link>
          <LogoutButton />
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        {/* Header */}
        <div className="mb-8">
          <span className="rounded-full border border-purple-500/30 bg-purple-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-purple-300">
            Open Mic Lineup
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            {post.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-brand-gray-300">
            {post.event_date ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                <Calendar
                  className="h-4 w-4 text-purple-300"
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
                {formatEventDateRange(post.event_date, post.event_end_date)}
              </span>
            ) : null}
            {post.event_location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                {post.event_location}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <CheckCircle2
                className="h-4 w-4"
                strokeWidth={2.25}
                aria-hidden="true"
              />
              {checkedInCount} of {roster.length} checked in
            </span>
          </div>
          <p className="mt-4 text-sm text-brand-gray-400">
            Bands are listed in signup order. Use the arrows to set the running
            order: whoever arrives first can be moved up. Check bands in as they
            arrive.
          </p>
        </div>

        <RosterList roster={roster} />
      </section>
    </main>
  );
}

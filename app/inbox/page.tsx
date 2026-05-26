import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, MessageCircle, type LucideIcon } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import {
  getIncomingRequests,
  getThreadSummaries,
} from "@/lib/supabase/messaging";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { InboxBell } from "@/components/inbox/InboxBell";
import { AdminLink } from "@/components/admin/AdminLink";
import { RequestCard } from "@/components/inbox/RequestCard";
import { ThreadListItem } from "@/components/inbox/ThreadListItem";
import { InboxTabs } from "@/components/inbox/InboxTabs";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, isComplete } = await getOnboardingStatus(supabase, user.id);
  if (!isComplete || !profile || !profile.profile_id)
    redirect("/onboarding");

  const tab = searchParams.tab === "conversations" ? "conversations" : "requests";

  const [requests, threads] = await Promise.all([
    getIncomingRequests(supabase, user.id),
    getThreadSummaries(supabase, user.id, profile.profile_id),
  ]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black pb-20">
      <header className="flex items-center justify-between border-b border-white/10 shadow-sm shadow-black/40 px-5 py-4 sm:px-8">
        <Link href="/search">
          <Logo className="text-2xl" />
        </Link>
        <nav className="hidden items-center gap-2 sm:flex">
          <Link
            href="/search"
            className="rounded-full px-4 py-2 text-sm font-semibold text-brand-gray-300 transition hover:text-white"
          >
            Discover
          </Link>
          <Link
            href="/opportunities"
            className="rounded-full px-4 py-2 text-sm font-semibold text-brand-gray-300 transition hover:text-white"
          >
            Feed
          </Link>
          <Link
            href="/inbox"
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white"
          >
            Inbox
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <AdminLink />
          <InboxBell />
          {profile.profile_id ? (
            <Link
              href={`/profile/${profile.profile_id}`}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              My profile
            </Link>
          ) : null}
          <LogoutButton />
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-6">
          <h1 className="text-2xl font-bold sm:text-3xl">Inbox</h1>
          <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
            Pending connection requests and your active conversations.
          </p>
        </div>

        <InboxTabs
          requestCount={requests.length}
          threadCount={threads.length}
        />

        <div className="mt-6 space-y-3">
          {tab === "requests" ? (
            requests.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No pending requests"
                body="When someone sends you a Connect request or responds to a post you created, it'll show up here."
              />
            ) : (
              requests.map((r) => (
                <RequestCard key={r.request_id} request={r} />
              ))
            )
          ) : threads.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="No conversations yet"
              body="Accept a connection request to start chatting. Or, if you're an industry player, send someone a direct message from their profile."
            />
          ) : (
            threads.map((t) => (
              <ThreadListItem key={t.thread_id} thread={t} />
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 p-10 text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange">
        <Icon className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
      </div>
      <h2 className="mt-3 text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-brand-gray-300">{body}</p>
    </div>
  );
}

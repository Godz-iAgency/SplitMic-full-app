import { redirect } from "next/navigation";
import { Inbox, MessageCircle, type LucideIcon } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import {
  getIncomingRequests,
  getThreadSummaries,
} from "@/lib/supabase/messaging";
import { AppHeader } from "@/components/AppHeader";
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
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black pb-24 md:pb-20">
      <AppHeader active="inbox" profileId={profile.profile_id} />

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

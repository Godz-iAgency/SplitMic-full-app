import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import { getThreadDetail } from "@/lib/supabase/messaging";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { MessageComposer } from "@/components/inbox/MessageComposer";
import { MarkReadOnMount } from "@/components/inbox/MarkReadOnMount";
import { PLAYER_TYPE_OPTIONS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ThreadPage({
  params,
}: {
  params: { threadId: string };
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, isComplete } = await getOnboardingStatus(supabase, user.id);
  if (!isComplete || !profile || !profile.profile_id)
    redirect("/onboarding");

  const detail = await getThreadDetail(
    supabase,
    params.threadId,
    user.id,
    profile.profile_id,
  );
  if (!detail) notFound();

  const playerOption = PLAYER_TYPE_OPTIONS.find(
    (o) => o.value === detail.other_player_type,
  );

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-black via-brand-gray-900 to-black">
      <MarkReadOnMount threadId={detail.thread_id} />

      <header className="flex items-center justify-between border-b border-white/5 px-5 py-4 sm:px-8">
        <Link href="/search">
          <Logo className="text-2xl" />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/inbox"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Inbox
          </Link>
          <LogoutButton />
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-0 sm:px-8">
        {/* Other party header */}
        <Link
          href={`/profile/${detail.other_profile_id}`}
          className="flex items-center gap-3 border-b border-white/10 bg-white/5 px-5 py-4 transition hover:bg-white/10"
        >
          {detail.other_avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={detail.other_avatar_url}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gray-800 text-sm font-bold text-brand-orange">
              {detail.other_name.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-white">
              {detail.other_name}
            </p>
            <p className="truncate text-xs text-brand-gray-400">
              {playerOption?.label ?? detail.other_player_type}
            </p>
          </div>
          <span className="text-xs text-brand-gray-400">View profile →</span>
        </Link>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-6 sm:px-0">
          {detail.messages.length === 0 ? (
            <p className="rounded-2xl border border-white/5 bg-white/5 p-6 text-center text-sm text-brand-gray-400">
              No messages yet. Say hi 👋
            </p>
          ) : (
            detail.messages.map((m) => {
              const isMine = m.sender_profile_id === detail.my_profile_id;
              return (
                <div
                  key={m.id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      isMine
                        ? "bg-brand-orange text-black"
                        : "bg-white/10 text-white"
                    }`}
                  >
                    <p className="whitespace-pre-line text-sm">{m.body}</p>
                    <p
                      className={`mt-1 text-[10px] ${
                        isMine ? "text-black/60" : "text-brand-gray-400"
                      }`}
                    >
                      {formatMessageTime(m.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <MessageComposer threadId={detail.thread_id} />
      </section>
    </main>
  );
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

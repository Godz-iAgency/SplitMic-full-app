import Link from "next/link";
import { PLAYER_TYPE_OPTIONS } from "@/lib/types";
import type { ThreadSummary } from "@/lib/supabase/messaging";

export function ThreadListItem({ thread }: { thread: ThreadSummary }) {
  const playerOption = PLAYER_TYPE_OPTIONS.find(
    (o) => o.value === thread.other_player_type,
  );

  return (
    <Link
      href={`/inbox/${thread.thread_id}`}
      className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 transition hover:border-brand-orange/30 hover:bg-white/[.07]"
    >
      {thread.other_avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thread.other_avatar_url}
          alt=""
          className="h-12 w-12 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-gray-800 text-base font-bold text-brand-orange">
          {thread.other_name.charAt(0)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold text-white">
            {thread.other_name}
          </p>
          {thread.unread_count > 0 ? (
            <span className="shrink-0 rounded-full bg-brand-orange px-2 py-0.5 text-[10px] font-bold text-black">
              {thread.unread_count}
            </span>
          ) : null}
        </div>
        <p className="truncate text-[11px] uppercase tracking-wider text-brand-gray-400">
          {playerOption?.label ?? thread.other_player_type}
        </p>
        {thread.last_message_preview ? (
          <p
            className={`mt-1 truncate text-sm ${
              thread.unread_count > 0
                ? "font-semibold text-white"
                : "text-brand-gray-400"
            }`}
          >
            {thread.last_message_preview}
          </p>
        ) : (
          <p className="mt-1 text-sm italic text-brand-gray-400">
            No messages yet
          </p>
        )}
      </div>
    </Link>
  );
}

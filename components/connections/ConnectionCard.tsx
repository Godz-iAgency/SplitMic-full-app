import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { PLAYER_TYPE_OPTIONS } from "@/lib/types";
import { PlayerTypeIcon } from "@/components/landing/PlayerTypeIcon";
import type { Connection } from "@/lib/supabase/messaging";

/**
 * A single connection row: avatar + name (→ their profile) + player-type label,
 * with a Message shortcut that jumps straight to the existing DM thread.
 */
export function ConnectionCard({ connection }: { connection: Connection }) {
  const playerOption = PLAYER_TYPE_OPTIONS.find(
    (o) => o.value === connection.player_type,
  );

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 transition hover:border-brand-orange/30 hover:bg-white/[.07]">
      {/* Avatar → profile */}
      <Link
        href={`/profile/${connection.profile_id}`}
        aria-label={`View ${connection.name}'s profile`}
        className="shrink-0"
      >
        {connection.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={connection.avatar_url}
            alt=""
            className="h-12 w-12 rounded-full object-cover ring-1 ring-white/10"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-gray-800 text-base font-bold text-brand-orange ring-1 ring-white/10">
            {connection.name.charAt(0)}
          </div>
        )}
      </Link>

      {/* Name + type → profile */}
      <Link
        href={`/profile/${connection.profile_id}`}
        className="min-w-0 flex-1"
      >
        <p className="truncate font-semibold text-white transition hover:text-brand-orange">
          {connection.name}
        </p>
        <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-brand-gray-400">
          <PlayerTypeIcon
            type={connection.player_type}
            className="h-3.5 w-3.5 text-brand-orange"
            strokeWidth={2}
          />
          {playerOption?.label ?? connection.player_type}
        </p>
      </Link>

      {/* Message → existing thread */}
      <Link
        href={`/inbox/${connection.thread_id}`}
        aria-label={`Message ${connection.name}`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-orange px-3.5 py-2 text-sm font-bold text-black tappable hover:bg-brand-orange/90"
      >
        <MessageCircle className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        <span className="hidden sm:inline">Message</span>
      </Link>
    </div>
  );
}

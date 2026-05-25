import Link from "next/link";
import { Bell } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTotalUnreadCount } from "@/lib/supabase/messaging";

/**
 * Server-rendered bell icon for the header. Shows a small orange badge with the
 * count of pending requests + unread messages.
 */
export async function InboxBell() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return null;

  const count = await getTotalUnreadCount(supabase, user.id, profile.id);

  return (
    <Link
      href="/inbox"
      aria-label="Inbox"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10 hover:text-brand-orange"
    >
      <Bell className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-bold text-black">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

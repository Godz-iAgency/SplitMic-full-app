import Link from "next/link";
import { LayoutDashboard, MessageCircle } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/supabase/admin";

/**
 * Server component. The mobile/tablet header shortcut next to the logo.
 *
 * For a normal account it's the Messages shortcut, straight to conversations.
 * An admin account has no real profile, so /inbox bounces it through
 * /onboarding to /admin — the icon looked like "Messages" but always landed
 * on the dashboard, confusing on a personal admin account. Swapped to a
 * dashboard icon + matching link for admins so what you tap is what you get.
 */
export async function HeaderMessagesLink() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = !!user && isAdminEmail(user.email);

  return (
    <Link
      href={admin ? "/admin" : "/inbox?tab=conversations"}
      aria-label={admin ? "Admin dashboard" : "Messages"}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10 hover:text-brand-orange lg:hidden"
    >
      {admin ? (
        <LayoutDashboard className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <MessageCircle className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
      )}
    </Link>
  );
}

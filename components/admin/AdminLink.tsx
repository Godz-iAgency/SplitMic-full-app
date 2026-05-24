import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/supabase/admin";

/**
 * Server component. Renders an "Admin" link in headers — only for admin users.
 * Renders nothing for everyone else.
 */
export async function AdminLink() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;

  return (
    <Link
      href="/admin"
      className="rounded-full bg-brand-orange/20 px-4 py-2 text-sm font-bold text-brand-orange transition hover:bg-brand-orange/30"
    >
      Admin
    </Link>
  );
}

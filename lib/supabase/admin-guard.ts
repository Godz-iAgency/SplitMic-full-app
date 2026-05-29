import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isAdminEmail } from "@/lib/supabase/admin";

/**
 * Verifies — using the cookie-based session client — that the current user is an
 * admin, then returns a privileged service-role client for reading data the
 * admin dashboard needs (unpublished/suspended profiles, the audit log, etc.).
 *
 * Redirects non-admins. Use this in admin Server Components instead of
 * createServerSupabaseClient() so RLS doesn't hide cross-user rows.
 */
export async function getAdminServiceClient() {
  const sessionClient = createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/search");

  return createServiceRoleClient();
}

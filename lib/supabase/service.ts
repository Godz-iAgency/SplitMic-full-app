import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 *
 * SECURITY: This client must only ever be created inside server-side code that
 * has already verified the caller is an admin. It reads SUPABASE_SERVICE_ROLE_KEY,
 * which has NO `NEXT_PUBLIC_` prefix, so Next.js will never ship it to the browser
 * bundle — if this module were imported by a Client Component the key would be
 * undefined and this function would throw.
 *
 * Never expose the returned client to the client, and never pass user-controlled
 * input into a query without scoping it yourself — RLS is off here.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Service-role client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.",
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
